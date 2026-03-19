class Vakt < Formula
  desc "Secure MCP runtime — policy, audit, registry, multi-provider sync"
  homepage "https://github.com/tn819/vakt"
  version "0.8.0"

  on_macos do
    on_arm do
      url "https://github.com/tn819/vakt/releases/download/v0.8.0/vakt-0.8.0-darwin-arm64.tar.gz"
      sha256 "6d08494b75946349243e689ad93c9f7de3e4a31f8e408c5fc281649beddb052b"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/tn819/vakt/releases/download/v0.8.0/vakt-0.8.0-linux-x86_64.tar.gz"
      sha256 "9178d3f23ca8dc40a1ed5a62b526861ffb3a7a79bb22d368cc25565dfdefebb5"
    end
  end

  def install
    bin.install "vakt"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/vakt --version")
  end
end
