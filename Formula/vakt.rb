class Vakt < Formula
  desc "Secure MCP runtime — policy, audit, registry, multi-provider sync"
  homepage "https://github.com/tn819/vakt"
  version "0.6.4"

  on_macos do
    on_arm do
      url "https://github.com/tn819/vakt/releases/download/v0.6.4/vakt-0.6.4-darwin-arm64.tar.gz"
      sha256 "872a29d43a663e4dbf9e02829b283fe2a2651b2cd78c3a624d2a68a44f3ae136"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/tn819/vakt/releases/download/v0.6.4/vakt-0.6.4-linux-x86_64.tar.gz"
      sha256 "38a4a3ba99a18727393a23db43256055ac459e8fd82a003aa06ca0f681b70094"
    end
  end

  def install
    bin.install "vakt"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/vakt --version")
  end
end
