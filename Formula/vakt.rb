class Vakt < Formula
  desc "Secure MCP runtime — policy, audit, registry, multi-provider sync"
  homepage "https://github.com/tn819/vakt"
  version "0.5.0"

  on_macos do
    on_arm do
      url "https://github.com/tn819/vakt/releases/download/v0.5.0/vakt-0.5.0-darwin-arm64.tar.gz"
      sha256 "b8896951156bd9c0eadb3da03e6abeef57cbecb2bc14f5a02732f55f8709b8e2"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/tn819/vakt/releases/download/v0.5.0/vakt-0.5.0-linux-x86_64.tar.gz"
      sha256 "01b9e086f9f60fb8a4fd125bbc73d11d894397c2e15efec80b880b57fc0dfc1f"
    end
  end

  def install
    bin.install "vakt"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/vakt --version")
  end
end
