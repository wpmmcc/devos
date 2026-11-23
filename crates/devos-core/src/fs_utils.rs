use crate::error::{DevosError, Result};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

fn echo_cache() -> &'static Mutex<HashMap<PathBuf, Instant>> {
    static CACHE: OnceLock<Mutex<HashMap<PathBuf, Instant>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Record that DevOS internally wrote to this path, so file watchers can ignore this echo
pub fn record_self_write(path: &Path) {
    if let Ok(mut cache) = echo_cache().lock() {
        let now = Instant::now();
        cache.retain(|_, time| now.duration_since(*time) < Duration::from_secs(5));
        let key = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
        cache.insert(key, now);
    }
}

/// Check if a path was modified by DevOS within the given timeout (e.g. 600ms)
pub fn is_self_write_echo(path: &Path, window: Duration) -> bool {
    if let Ok(mut cache) = echo_cache().lock() {
        let now = Instant::now();
        cache.retain(|_, time| now.duration_since(*time) < Duration::from_secs(5));

        let key = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
        if let Some(time) = cache.get(&key) {
            if now.duration_since(*time) <= window {
                return true;
            }
        }
    }
    false
}

/// Atomically write content to a file by writing to a temporary file in the same directory,
/// ensuring standard LF line endings, and then renaming it.
pub fn atomic_write<P: AsRef<Path>, C: AsRef<[u8]>>(path: P, content: C) -> Result<()> {
    let path = path.as_ref();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    // Convert string content CRLF to LF if it's UTF-8
    let bytes = content.as_ref();
    let sanitized_bytes: Vec<u8> = if let Ok(s) = std::str::from_utf8(bytes) {
        s.replace("\r\n", "\n").into_bytes()
    } else {
        bytes.to_vec()
    };

    let parent_dir = path.parent().unwrap_or_else(|| Path::new("."));
    let file_name = path.file_name().and_then(|f| f.to_str()).unwrap_or("file");
    let tmp_path = parent_dir.join(format!(
        ".{}.tmp.{}",
        file_name,
        uuid::Uuid::new_v4().simple()
    ));

    let mut tmp_file = fs::File::create(&tmp_path)?;
    tmp_file.write_all(&sanitized_bytes)?;
    tmp_file.sync_all()?;
    drop(tmp_file);

    fs::rename(&tmp_path, path).map_err(|e| {
        let _ = fs::remove_file(&tmp_path);
        DevosError::Io(e)
    })?;

    // Record internal write for watcher echo cancellation
    record_self_write(path);

    Ok(())
}

/// Atomically serialize and write JSON to a file with pretty formatting.
pub fn atomic_write_json<P: AsRef<Path>, T: serde::Serialize>(path: P, value: &T) -> Result<()> {
    let json_bytes = serde_json::to_vec_pretty(value)?;
    atomic_write(path, json_bytes)
}

/// Read file content to string
pub fn read_to_string<P: AsRef<Path>>(path: P) -> Result<String> {
    fs::read_to_string(path).map_err(DevosError::Io)
}

/// Strip comments (line and block) and trailing commas from JSONC content
pub fn clean_jsonc(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let chars: Vec<char> = input.chars().collect();
    let len = chars.len();
    let mut i = 0;
    let mut in_string = false;
    let mut escape = false;

    while i < len {
        let c = chars[i];

        if in_string {
            out.push(c);
            if escape {
                escape = false;
            } else if c == '\\' {
                escape = true;
            } else if c == '"' {
                in_string = false;
            }
            i += 1;
            continue;
        }

        if c == '"' {
            in_string = true;
            out.push(c);
            i += 1;
            continue;
        }

        // Line comment //
        if c == '/' && i + 1 < len && chars[i + 1] == '/' {
            i += 2;
            while i < len && chars[i] != '\n' {
                i += 1;
            }
            continue;
        }

        // Block comment /* */
        if c == '/' && i + 1 < len && chars[i + 1] == '*' {
            i += 2;
            while i + 1 < len && !(chars[i] == '*' && chars[i + 1] == '/') {
                i += 1;
            }
            i += 2; // skip */
            continue;
        }

        out.push(c);
        i += 1;
    }

    // Now remove trailing commas: comma followed by whitespace and closing '}' or ']'
    let mut cleaned = String::with_capacity(out.len());
    let out_chars: Vec<char> = out.chars().collect();
    let out_len = out_chars.len();
    let mut j = 0;
    let mut in_str = false;
    let mut esc = false;

    while j < out_len {
        let c = out_chars[j];
        if in_str {
            cleaned.push(c);
            if esc {
                esc = false;
            } else if c == '\\' {
                esc = true;
            } else if c == '"' {
                in_str = false;
            }
            j += 1;
            continue;
        }

        if c == '"' {
            in_str = true;
            cleaned.push(c);
            j += 1;
            continue;
        }

        if c == ',' {
            // Peek forward to see if the next non-whitespace char is '}' or ']'
            let mut k = j + 1;
            while k < out_len && out_chars[k].is_whitespace() {
                k += 1;
            }
            if k < out_len && (out_chars[k] == '}' || out_chars[k] == ']') {
                // Skip the trailing comma!
                j += 1;
                continue;
            }
        }

        cleaned.push(c);
        j += 1;
    }

    cleaned
}

/// Read and deserialize JSON from a file with forgiving JSONC and trailing comma support
pub fn read_json<P: AsRef<Path>, T: serde::de::DeserializeOwned>(path: P) -> Result<T> {
    let p = path.as_ref();
    let content = read_to_string(p)?;
    match serde_json::from_str::<T>(&content) {
        Ok(val) => Ok(val),
        Err(orig_err) => {
            // Forgiving fallback: try parsing cleaned JSONC
            let cleaned = clean_jsonc(&content);
            if let Ok(val) = serde_json::from_str::<T>(&cleaned) {
                return Ok(val);
            }

            // Check if backup file exists
            let bak_path = p.with_extension("json.bak");
            if bak_path.exists() {
                if let Ok(bak_content) = read_to_string(&bak_path) {
                    if let Ok(val) = serde_json::from_str::<T>(&bak_content) {
                        return Ok(val);
                    }
                }
            }

            Err(DevosError::Serialization(orig_err))
        }
    }
}

/// Convert any path to relative POSIX style ("dir/sub/file.ext")
pub fn to_posix_path<P: AsRef<Path>>(path: P) -> String {
    let p = path.as_ref();
    let components: Vec<String> = p
        .components()
        .map(|c| c.as_os_str().to_string_lossy().to_string())
        .collect();
    components.join("/")
}

/// Ensure path is strictly within the project root directory, preventing directory traversal and symlink escapes
pub fn ensure_within_root(root: &Path, target: &Path) -> Result<PathBuf> {
    let canonical_root = root.canonicalize().map_err(DevosError::Io)?;
    let resolved = if target.is_relative() {
        canonical_root.join(target)
    } else {
        target.to_path_buf()
    };

    // If target exists, canonicalize directly to resolve any symlinks
    let canonical_target = if resolved.exists() {
        resolved.canonicalize().map_err(DevosError::Io)?
    } else if let Some(parent) = resolved.parent() {
        if parent.exists() {
            let parent_canonical = parent.canonicalize().map_err(DevosError::Io)?;
            parent_canonical.join(resolved.file_name().unwrap_or_default())
        } else {
            resolved
        }
    } else {
        resolved
    };

    if !canonical_target.starts_with(&canonical_root) {
        return Err(DevosError::GuardrailBlocked {
            code: "GUARDRAIL_PATH_OUT_OF_SANDBOX".to_string(),
            reason: format!("Path {:?} is outside of project root {:?}", target, root),
            hint: "Please ensure the path is relative to the project workspace root.".to_string(),
            plain_message: "该文件路径超出了项目目录安全范围（禁止路径穿越或符号链接逃逸）。"
                .to_string(),
        });
    }

    Ok(canonical_target)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_jsonc_comments_and_trailing_commas() {
        let raw = r#"{
            // This is a line comment
            "name": "devos", /* block comment */
            "items": [
                "a",
                "b", // another comment
            ],
            "nested": {
                "flag": true,
            },
        }"#;

        let cleaned = clean_jsonc(raw);
        let parsed: serde_json::Value =
            serde_json::from_str(&cleaned).expect("Failed to parse cleaned jsonc");
        assert_eq!(parsed["name"], "devos");
        assert_eq!(parsed["items"][0], "a");
        assert_eq!(parsed["nested"]["flag"], true);
    }
}
