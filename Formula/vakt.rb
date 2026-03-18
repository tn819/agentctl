class Vakt < Formula
  desc "Secure MCP runtime — policy, audit, registry, multi-provider sync"
  homepage "https://github.com/tn819/vakt"
  version "0.6.0"

  on_macos do
    on_arm do
      url "https://github.com/tn819/vakt/releases/download/v0.6.0/vakt-0.6.0-darwin-arm64.tar.gz"
      sha256 "a0ef2341cea721f53e87da2e6d01f419eb4dc1d2413e821c80c6100b64f1b815"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/tn819/vakt/releases/download/v0.6.0/vakt-0.6.0-linux-x86_64.tar.gz"
      sha256 "85a68f3c6654926f4b99b38c5c0562e8643a1a982f43f4a1da9903319782c7a2"
    end
  end

  def install
    bin.install "vakt"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/vakt --version")
  end
end
