import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <span className="text-xl font-bold text-white">TOGI</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors">
              Dashboard
            </Link>
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Open Dashboard
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-full text-sm text-slate-400 mb-8">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Real-time protection active
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
          Real-time protection for
          <br />
          <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Telegram groups
          </span>
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-12">
          AI-powered moderation, instant threat detection, and explainable actions.
          Keep your community safe without the complexity.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/dashboard"
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-lg transition-colors"
          >
            Open Dashboard
          </Link>
          <a
            href="#features"
            className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold text-lg transition-colors"
          >
            Learn More
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-white text-center mb-12">
          Everything you need to protect your group
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon="🛡️"
            title="Spam & Flood Protection"
            description="Block message floods and spam with customizable thresholds. Redis-based detection under 20ms."
          />
          <FeatureCard
            icon="🔗"
            title="Scam Link Defense"
            description="Automatically detect and block malicious URLs, shorteners, and phishing links."
          />
          <FeatureCard
            icon="👋"
            title="New Member Probation"
            description="Restrict new users during a probation period. Block links and media until trusted."
          />
          <FeatureCard
            icon="🚨"
            title="Raid Mode"
            description="Instantly lock down your group during raid attacks. Auto-detect mass-joins."
          />
          <FeatureCard
            icon="📊"
            title="Explainable Moderation"
            description="Every action has a clear reason. See risk scores, labels, and decision thresholds."
          />
          <FeatureCard
            icon="📈"
            title="Group Security Score"
            description="Understand your group's security posture at a glance. 0-100 score with breakdown."
          />
        </div>
      </section>

      {/* Add Bot CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-slate-700 rounded-2xl p-8 md:p-12 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to secure your Telegram group?
          </h2>
          <p className="text-slate-400 mb-8 max-w-xl mx-auto">
            Add the TOGI bot to your group with admin permissions and start protecting immediately.
            No credit card required.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-lg transition-colors"
          >
            Get Started Free
            <span>→</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8">
        <div className="container mx-auto px-4 text-center text-slate-500">
          <p>TOGI Security Platform • Built with ❤️ for Telegram communities</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-sm">{description}</p>
    </div>
  );
}