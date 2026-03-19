class Vakt < Formula
  desc "Secure MCP runtime — policy, audit, registry, multi-provider sync"
  homepage "https://github.com/tn819/vakt"
  version "0.7.0"

  on_macos do
    on_arm do
      url "https://github.com/tn819/vakt/releases/download/v0.7.0/vakt-0.7.0-darwin-arm64.tar.gz"
      sha256 "704c73fd22ffbb89fe8c7fab3eed60ee9dab2a3c5d9293a08cb456408cdd0078"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/tn819/vakt/releases/download/v0.7.0/vakt-0.7.0-linux-x86_64.tar.gz"
      sha256 "a09f4eaff9a5e9752472d80aba2e4ca06771c087949e81082ab0d8af0cd05171"
    end
  end

  def install
    bin.install "vakt"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/vakt --version")
  end
end
