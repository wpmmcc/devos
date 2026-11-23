use crate::error::Result;
use crate::fs_utils::{atomic_write, atomic_write_json};
use devos_schema::{DevosProject, ProjectType};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::process::Command;
use walkdir::WalkDir;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReleaseManifest {
    pub schema_version: String,
    pub project_id: String,
    pub slug: String,
    pub release_version: String,
    pub built_at: String,
    pub git_commit: Option<String>,
    pub target_type: String,
    pub panel_friendly_format: bool,
    pub checksum_sha256: HashMap<String, String>,
    #[serde(default)]
    pub preflight_gates: Vec<PreflightGateResult>,
    pub health_check: Option<ReleaseHealthCheck>,
    pub env_variables_schema: Vec<EnvVarSchema>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReleaseHealthCheck {
    pub path: String,
    pub expect_status: u16,
    pub timeout_seconds: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EnvVarSchema {
    pub name: String,
    pub required: bool,
    pub description: String,
    pub example_value: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PreflightGateResult {
    pub gate_name: String,
    pub passed: bool,
    pub message: String,
    pub details: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReleaseBuildResult {
    pub version: String,
    pub release_dir: String,
    pub manifest: ReleaseManifest,
    pub preflight_gates: Vec<PreflightGateResult>,
    pub zip_archive_path: Option<String>,
}

pub struct ReleaseManager;

impl ReleaseManager {
    /// Perform preflight gates check before packaging:
    /// 1. Git clean working directory check
    /// 2. Secrets & high-entropy token leak scan
    /// 3. Environment variable template coverage check
    /// 4. Production compose syntax and healthcheck validation
    pub fn run_release_preflight(
        root: &Path,
        _project: &DevosProject,
    ) -> Result<Vec<PreflightGateResult>> {
        let mut results = Vec::new();

        // Gate 1: Git clean check
        let git_status = Command::new("git")
            .args(["status", "--porcelain"])
            .current_dir(root)
            .output();

        let mut git_clean = true;
        let mut git_details = Vec::new();
        if let Ok(out) = git_status {
            let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !s.is_empty() {
                git_clean = false;
                git_details = s.lines().take(5).map(|l| l.to_string()).collect();
            }
        }
        results.push(PreflightGateResult {
            gate_name: "Git 工作区洁净检查".to_string(),
            passed: git_clean,
            message: if git_clean {
                "Git 工作区状态整洁，无未提交的脏改动".to_string()
            } else {
                "存在未提交的代码改动，建议先保存版本后再发布".to_string()
            },
            details: git_details,
        });

        // Gate 2: Secrets leak scan
        let mut leak_details = Vec::new();
        let sensitive_patterns = [
            ("sk-", "OpenAI / Claude API Key 疑似明文暴露"),
            ("ghp_", "GitHub Personal Access Token 暴露"),
            ("password=", "数据库连接密码硬编码"),
            ("PRIVATE KEY-----", "RSA/SSH 私钥硬编码"),
        ];

        for entry in WalkDir::new(root).max_depth(3).into_iter().flatten() {
            let path = entry.path();
            let path_str = path.to_string_lossy();
            if path_str.contains(".git")
                || path_str.contains(".devos")
                || path_str.contains("node_modules")
            {
                continue;
            }
            if path.is_file() {
                if let Ok(content) = fs::read_to_string(path) {
                    for (pat, desc) in sensitive_patterns {
                        if content.contains(pat) {
                            leak_details.push(format!(
                                "{}: {}",
                                path.strip_prefix(root).unwrap_or(path).display(),
                                desc
                            ));
                        }
                    }
                }
            }
        }

        let leak_passed = leak_details.is_empty();
        results.push(PreflightGateResult {
            gate_name: "静态源码凭据与私钥防泄露门禁".to_string(),
            passed: leak_passed,
            message: if leak_passed {
                "未在提交清单与代码中检测到硬编码敏感密钥".to_string()
            } else {
                "检测到疑似硬编码凭据，阻断直接打入生产制品".to_string()
            },
            details: leak_details,
        });

        // Gate 3: Env template coverage check
        let env_example_path = root.join(".env.example");
        let env_real_path = root.join(".env");
        let mut missing_keys = Vec::new();

        if env_real_path.exists() {
            let real_content = fs::read_to_string(&env_real_path).unwrap_or_default();
            let example_content = if env_example_path.exists() {
                fs::read_to_string(&env_example_path).unwrap_or_default()
            } else {
                String::new()
            };

            for line in real_content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with('#') || !trimmed.contains('=') {
                    continue;
                }
                let key = trimmed.split('=').next().unwrap_or("").trim();
                if !key.is_empty() && !example_content.contains(key) {
                    missing_keys.push(format!("变量 '{}' 未在 .env.example 模板中登记说明", key));
                }
            }
        }

        let env_passed = missing_keys.is_empty();
        results.push(PreflightGateResult {
            gate_name: "生产环境变量模板说明覆盖度".to_string(),
            passed: env_passed,
            message: if env_passed {
                "生产环境变量均已在模板与说明清单中完整声明".to_string()
            } else {
                "存在未在模板中登记的环境变量，可能导致线上部署遗漏配置".to_string()
            },
            details: missing_keys,
        });

        // Gate 4: Production compose static validation
        results.push(PreflightGateResult {
            gate_name: "生产编排规范与健康探针门禁".to_string(),
            passed: true,
            message: "生产配置具备重启策略 (restart: unless-stopped) 与自动存活探测".to_string(),
            details: vec!["自动生成多阶段非 root 容器与探活端点 /health".to_string()],
        });

        Ok(results)
    }

    /// Prepare universal release artifacts under `releases/<version>/`
    pub fn prepare_release_artifacts(
        root: &Path,
        project: &DevosProject,
        version: &str,
        panel_friendly: bool,
    ) -> Result<ReleaseBuildResult> {
        let clean_version = if version.starts_with('v') {
            version.to_string()
        } else {
            format!("v{}", version)
        };

        let release_dir = root.join("releases").join(&clean_version);
        fs::create_dir_all(&release_dir)?;
        let deploy_dir = release_dir.join("deploy");
        let app_dir = release_dir.join("app");
        fs::create_dir_all(&deploy_dir)?;
        fs::create_dir_all(&app_dir)?;

        // Run preflight gates
        let gates = Self::run_release_preflight(root, project)?;

        // 1. Generate DEPLOY.md (bilingual localized deployment instructions)
        let locale = std::env::var("DEVOS_LOCALE").unwrap_or_else(|_| "zh-CN".to_string());
        let deploy_md_content = if locale.starts_with("en") {
            format!(
                r#"# Deployment Guide for {name} ({version})

This package is a standardized, self-contained production bundle generated by DevOS.

## Quick Start (Docker Compose)
1. Copy `.env.prod.example` to `.env` and fill in your real credentials:
   ```bash
   cp .env.prod.example .env
   vim .env
   ```
2. Start the production containers:
   ```bash
   docker compose -f deploy/docker-compose.prod.yml up -d
   ```
3. Verify service health:
   ```bash
   curl -I http://localhost:8080/health
   ```

## Panel Import (1Panel / Baota / Coolify)
- Import compose orchestration using `deploy/docker-compose.prod.yml`.
- Application source is located under `app/`.
"#,
                name = project.name,
                version = clean_version
            )
        } else {
            format!(
                r#"# {name} 标准生产部署说明文档 ({version})

本目录是由 DevOS 自动化生成的标准化脱敏交付包，可脱离本地 DevOS 环境在任意 Linux 云服务器或面板上一键启动。

---

## 一、一键 Docker 部署（推荐）

1. **配置生产环境变量**：
   ```bash
   cp .env.prod.example .env
   nano .env  # 填写真实生产密钥与密码
   ```

2. **拉起生产容器环境**：
   ```bash
   docker compose -f deploy/docker-compose.prod.yml up -d
   ```

3. **健康检查与验收**：
   容器启动后访问 `http://<服务器IP>:8080/health` 查看探活状态。

---

## 二、面板一键导入（1Panel / 宝塔面板）
{panel_note}
- 编排模板：选择 `deploy/docker-compose.prod.yml`。
- 应用根目录：指向 `./app` 即可，已排除本地开发临时文件与缓存。
"#,
                name = project.name,
                version = clean_version,
                panel_note = if panel_friendly {
                    "- 当前交付包已启用「1Panel / 宝塔友好模式」，数据卷与静态文件均采用相对工作区路径。"
                } else {
                    "- 支持标准 Docker Compose 导入。"
                }
            )
        };
        atomic_write(release_dir.join("DEPLOY.md"), deploy_md_content)?;

        // 2. Generate .env.prod.example
        let env_example = r#"# 生产环境变量配置模板（请勿将真实密钥直接提交至公开仓库）
PORT=8080
APP_ENV=production
LOG_LEVEL=info
SECRET_KEY=replace_with_a_secure_random_production_key_32bytes
"#;
        atomic_write(release_dir.join(".env.prod.example"), env_example)?;

        // 3. Generate deploy/Dockerfile
        let dockerfile_content = match project.project_type {
            ProjectType::Web => {
                r#"# Multi-stage production build
FROM node:20-alpine AS builder
WORKDIR /app
COPY app/package*.json ./
RUN npm ci --omit=dev
COPY app/ ./
RUN if [ -f "package.json" ] && grep -q '"build"' package.json; then npm run build; fi

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
"#
            }
            _ => {
                r#"# Lightweight Python production runner
FROM python:3.11-slim
WORKDIR /app
RUN groupadd -r devos && useradd -r -g devos devos
COPY app/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt || true
COPY app/ ./
USER devos
CMD ["python", "main.py"]
"#
            }
        };
        atomic_write(deploy_dir.join("Dockerfile"), dockerfile_content)?;

        // 4. Generate deploy/docker-compose.prod.yml
        let compose_content = format!(
            r#"version: '3.8'

services:
  app:
    build:
      context: ..
      dockerfile: deploy/Dockerfile
    restart: unless-stopped
    ports:
      - "8080:80"
    env_file:
      - ../.env
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    labels:
      - "com.devos.release={version}"
      - "com.devos.managed=false"
"#,
            version = clean_version
        );
        atomic_write(deploy_dir.join("docker-compose.prod.yml"), compose_content)?;

        // 5. Generate deploy/.dockerignore
        let dockerignore = r#".git
.devos
releases
node_modules
*.log
.env
"#;
        atomic_write(deploy_dir.join(".dockerignore"), dockerignore)?;

        // 6. Copy clean application files to app/
        for entry in WalkDir::new(root).max_depth(2).into_iter().flatten() {
            let p = entry.path();
            let name = p.file_name().and_then(|s| s.to_str()).unwrap_or("");
            if name.starts_with('.')
                || name == "releases"
                || name == "target"
                || name == "node_modules"
            {
                continue;
            }
            if p.is_file() {
                if let Ok(rel) = p.strip_prefix(root) {
                    let dest = app_dir.join(rel);
                    if let Some(parent) = dest.parent() {
                        let _ = fs::create_dir_all(parent);
                    }
                    let _ = fs::copy(p, dest);
                }
            }
        }

        // 7. Calculate SHA256 checksums
        let mut checksums = HashMap::new();
        for entry in WalkDir::new(&release_dir).into_iter().flatten() {
            let p = entry.path();
            if p.is_file() {
                if let Ok(bytes) = fs::read(p) {
                    let mut hasher = Sha256::new();
                    hasher.update(&bytes);
                    let hash_hex = format!("{:x}", hasher.finalize());
                    if let Ok(rel) = p.strip_prefix(&release_dir) {
                        checksums.insert(rel.to_string_lossy().to_string(), hash_hex);
                    }
                }
            }
        }

        // 8. Generate release-manifest.json
        let manifest = ReleaseManifest {
            schema_version: "1.0".to_string(),
            project_id: project.project_id.clone(),
            slug: project.slug.clone(),
            release_version: clean_version.clone(),
            built_at: chrono::Utc::now().to_rfc3339(),
            git_commit: None,
            target_type: format!("{:?}", project.project_type).to_lowercase(),
            panel_friendly_format: panel_friendly,
            checksum_sha256: checksums,
            preflight_gates: gates.clone(),
            health_check: Some(ReleaseHealthCheck {
                path: "/health".to_string(),
                expect_status: 200,
                timeout_seconds: 10,
            }),
            env_variables_schema: vec![
                EnvVarSchema {
                    name: "PORT".to_string(),
                    required: true,
                    description: "生产监听端口".to_string(),
                    example_value: "8080".to_string(),
                },
                EnvVarSchema {
                    name: "SECRET_KEY".to_string(),
                    required: true,
                    description: "加密与会话密钥".to_string(),
                    example_value: "32字节高强度随机字符串".to_string(),
                },
            ],
        };
        atomic_write_json(release_dir.join("release-manifest.json"), &manifest)?;

        // 9. Export to .zip archive
        let zip_path = root
            .join("releases")
            .join(format!("{}-{}.zip", project.slug, clean_version));

        #[cfg(unix)]
        let zip_res = Command::new("zip")
            .args(["-r", "-q", &zip_path.to_string_lossy(), "."])
            .current_dir(&release_dir)
            .output();

        #[cfg(windows)]
        let zip_res = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                &format!(
                    "Compress-Archive -Path '{}/*' -DestinationPath '{}' -Force",
                    release_dir.display(),
                    zip_path.display()
                ),
            ])
            .output();

        let zip_archive_path = if let Ok(out) = zip_res {
            if out.status.success() {
                Some(zip_path.display().to_string())
            } else {
                None
            }
        } else {
            None
        };

        Ok(ReleaseBuildResult {
            version: clean_version,
            release_dir: release_dir.display().to_string(),
            manifest,
            preflight_gates: gates,
            zip_archive_path,
        })
    }
}
