use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use crate::error::{DevosError, Result};

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
    let tmp_path = parent_dir.join(format!(".{}.tmp.{}", file_name, uuid::Uuid::new_v4().simple()));

    let mut tmp_file = fs::File::create(&tmp_path)?;
    tmp_file.write_all(&sanitized_bytes)?;
    tmp_file.sync_all()?;
    drop(tmp_file);

    fs::rename(&tmp_path, path).map_err(|e| {
        let _ = fs::remove_file(&tmp_path);
        DevosError::Io(e)
    })?;

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

/// Read and deserialize JSON from a file
pub fn read_json<P: AsRef<Path>, T: serde::de::DeserializeOwned>(path: P) -> Result<T> {
    let content = read_to_string(path)?;
    serde_json::from_str(&content).map_err(DevosError::Serialization)
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

/// Ensure path is within the project root directory to prevent directory traversal
pub fn ensure_within_root(root: &Path, target: &Path) -> Result<PathBuf> {
    let canonical_root = root.canonicalize().map_err(DevosError::Io)?;
    let canonical_target = if target.is_relative() {
        canonical_root.join(target)
    } else {
        target.to_path_buf()
    };

    if !canonical_target.starts_with(&canonical_root) {
        return Err(DevosError::GuardrailBlocked {
            code: "PATH_OUT_OF_BOUNDS".to_string(),
            reason: format!("Path {:?} is outside of project root {:?}", target, root),
            hint: "Please ensure the path is relative to the project workspace root.".to_string(),
            plain_message: "该文件路径超出了项目目录安全范围，已被安全护栏拦截。".to_string(),
        });
    }

    Ok(canonical_target)
}
