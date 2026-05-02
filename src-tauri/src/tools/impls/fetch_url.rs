use serde_json::{json, Value};

/// HTTP GET a URL restricted to localhost.
///
/// Scope: Network.
/// Phase 7c constraint: only `http://localhost` and `https://localhost` URLs are
/// permitted. All external URLs are rejected.
///
/// Security note: DNS rebinding limitation — this implementation validates the
/// URL host string as "localhost" or "127.0.0.1" before making the request, but
/// does NOT resolve the IP post-DNS-lookup. A sophisticated DNS rebinding attack
/// (where a controlled domain briefly resolves to 127.0.0.1 before switching to
/// an external IP) could bypass the string check. Mitigating this fully requires
/// resolving the hostname to an IP and verifying the IP is loopback BEFORE the
/// TCP connection, which reqwest does not expose. Acceptable risk for Phase 7c
/// local-only use case; revisit if network scope expands in Phase 8+.
pub fn run(args: Value) -> Result<Value, String> {
    let url_str = args["url"]
        .as_str()
        .ok_or_else(|| "missing required param: url".to_string())?;

    // Validate localhost restriction before any network activity.
    validate_localhost_url(url_str)?;

    // Use a blocking reqwest call with explicit timeout.
    // reqwest::blocking is appropriate here as Tauri tool calls are not on the
    // async executor — this avoids nested async runtime issues.
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("client build error: {e}"))?;

    let response = client
        .get(url_str)
        .send()
        .map_err(|e| format!("request error: {e}"))?;

    let status = response.status().as_u16();
    let body = response.text().map_err(|e| format!("body read error: {e}"))?;

    Ok(json!({
        "url": url_str,
        "status": status,
        "body": body,
    }))
}

/// Validate that the URL's host is localhost or 127.0.0.1.
fn validate_localhost_url(url_str: &str) -> Result<(), String> {
    let url = url_str.to_lowercase();

    // Must start with http:// or https://
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err(format!(
            "url not allowed: only http/https schemes permitted, got: {}",
            url_str
        ));
    }

    // Extract the host portion (between scheme and the next / or end of string)
    let after_scheme = if url.starts_with("https://") {
        &url["https://".len()..]
    } else {
        &url["http://".len()..]
    };

    // Host is everything up to the first '/', ':', or '?' or end of string
    let host = after_scheme
        .split(|c| c == '/' || c == ':' || c == '?' || c == '#')
        .next()
        .unwrap_or("");

    if host == "localhost" || host == "127.0.0.1" {
        Ok(())
    } else {
        Err(format!(
            "url not allowed: only localhost URLs permitted in Phase 7c, got host: {}",
            host
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn missing_url_param_returns_err() {
        let result = run(json!({}));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("missing required param: url"));
    }

    #[test]
    fn external_url_returns_err() {
        let result = run(json!({ "url": "https://example.com/api" }));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("url not allowed"));
    }

    #[test]
    fn anthropic_api_returns_err() {
        let result = run(json!({ "url": "https://api.anthropic.com/v1/messages" }));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("url not allowed"));
    }

    #[test]
    fn file_scheme_returns_err() {
        let result = run(json!({ "url": "file:///etc/passwd" }));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("url not allowed"));
    }

    #[test]
    fn localhost_http_passes_validation() {
        assert!(validate_localhost_url("http://localhost:11434/api/tags").is_ok());
    }

    #[test]
    fn localhost_https_passes_validation() {
        assert!(validate_localhost_url("https://localhost:8080/health").is_ok());
    }

    #[test]
    fn loopback_ip_passes_validation() {
        assert!(validate_localhost_url("http://127.0.0.1:3000/status").is_ok());
    }

    #[test]
    fn external_domain_fails_validation() {
        assert!(validate_localhost_url("https://google.com").is_err());
    }

    #[test]
    fn localhost_lookalike_fails_validation() {
        // e.g., "localhost.evil.com"
        assert!(validate_localhost_url("http://localhost.evil.com/payload").is_err());
    }
}
