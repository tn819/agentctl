class Vakt < Formula
  desc "Secure MCP runtime — policy, audit, registry, multi-provider sync"
  homepage "https://github.com/tn819/vakt"
  version "VAKT_VERSION"

  on_macos do
    on_arm do
      url "https://github.com/tn819/vakt/releases/download/vVAKT_VERSION/vakt-VAKT_VERSION-darwin-arm64.tar.gz"
      sha256 "VAKT_SHA256_DARWIN_ARM64"
    end
    on_intel do
      url "https://github.com/tn819/vakt/releases/download/vVAKT_VERSION/vakt-VAKT_VERSION-darwin-x86_64.tar.gz"
      sha256 "VAKT_SHA256_DARWIN_X86_64"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/tn819/vakt/releases/download/vVAKT_VERSION/vakt-VAKT_VERSION-linux-arm64.tar.gz"
      sha256 "VAKT_SHA256_LINUX_ARM64"
    end
    on_intel do
      url "https://github.com/tn819/vakt/releases/download/vVAKT_VERSION/vakt-VAKT_VERSION-linux-x86_64.tar.gz"
      sha256 "VAKT_SHA256_LINUX_X86_64"
    end
  end

  def install
    bin.install "vakt"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/vakt --version")
  end
end
