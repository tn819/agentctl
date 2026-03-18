class Vakt < Formula
  desc "Secure MCP runtime — policy, audit, registry, multi-provider sync"
  homepage "https://github.com/tn819/vakt"
  version "0.6.2"

  on_macos do
    on_arm do
      url "https://github.com/tn819/vakt/releases/download/v0.6.2/vakt-0.6.2-darwin-arm64.tar.gz"
      sha256 "3a594046ba3f48c78d5a31445a14a186e823820424bb216dc62b0faad190c9d8"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/tn819/vakt/releases/download/v0.6.2/vakt-0.6.2-linux-x86_64.tar.gz"
      sha256 "c9181ec9dc0f0c53a7647491146616cf2d3abeb5ac66eb90d9c6c6c09fc9b58f"
    end
  end

  def install
    bin.install "vakt"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/vakt --version")
  end
end
