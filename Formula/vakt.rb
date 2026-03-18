class Vakt < Formula
  desc "Secure MCP runtime — policy, audit, registry, multi-provider sync"
  homepage "https://github.com/tn819/vakt"
  version "0.6.3"

  on_macos do
    on_arm do
      url "https://github.com/tn819/vakt/releases/download/v0.6.3/vakt-0.6.3-darwin-arm64.tar.gz"
      sha256 "117ee6f49c97544d3c8ad1af90a5402c7be4e6b70932f902c264e3cd0c9f133e"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/tn819/vakt/releases/download/v0.6.3/vakt-0.6.3-linux-x86_64.tar.gz"
      sha256 "2a604ac3becede73c7742539f691b35e8e802a0f633b424b55871bb25167570a"
    end
  end

  def install
    bin.install "vakt"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/vakt --version")
  end
end
