import React from "react";
import Link from "next/link";
import { Calendar, BookOpen, ArrowRight, Phone, Mail, Download } from "lucide-react";
import { ServiceCard } from "@/components/public/ServiceCard";
import { BlogCard, BlogCardData } from "@/components/public/BlogCard";

const SERVICES = [
  {
    icon: <span className="text-xl">🕊️</span>,
    title: "Confession",
    description:
      "Private one-on-one confession sessions with Aba Gorgorios for spiritual cleansing and guidance in the Orthodox tradition.",
    audience: "All baptized Orthodox Christians",
    features: ["Private & confidential", "By appointment only", "Available weekly"],
    href: "/contact",
    accentColor: "#1B2E6B",
  },
  {
    icon: <span className="text-xl">🙏</span>,
    title: "Spiritual Counseling",
    description:
      "Personalized spiritual guidance to help you navigate life's challenges through faith, prayer, and Orthodox teachings.",
    audience: "Individuals & couples",
    features: ["Faith-based counseling", "Marriage guidance", "Personal growth"],
    href: "/contact",
    accentColor: "#2a6b3b",
  },
  {
    icon: <span className="text-xl">📖</span>,
    title: "Group Bible Study",
    description:
      "Weekly group sessions exploring the Holy Scriptures and Orthodox theology in a community setting.",
    audience: "All community members",
    features: ["Weekly gatherings", "Interactive discussion", "All levels welcome"],
    href: "/contact",
    accentColor: "#7b3f00",
  },
  {
    icon: <span className="text-xl">✨</span>,
    title: "Youth Guidance",
    description:
      "Programs dedicated to nurturing the faith of the younger generation through mentorship and Orthodox education.",
    audience: "Youth ages 13–25",
    features: ["Youth mentorship", "Orthodox education", "Community events"],
    href: "/contact",
    accentColor: "#6b1b6b",
  },
];

const SAMPLE_BLOGS: BlogCardData[] = [
  {
    id: "1",
    title: "The Importance of Fasting in the Orthodox Faith",
    content:
      "Fasting is one of the most ancient practices of the Christian church. In the Ethiopian Orthodox tradition, fasting is seen not merely as abstinence from food, but as a spiritual discipline that draws us closer to God through prayer and repentance...",
    category: "Teachings",
    authorName: "Aba Gorgorios",
    pinned: true,
    publishAt: null,
    createdAt: null,
  },
  {
    id: "2",
    title: "Understanding the Holy Trinity in Orthodox Christianity",
    content:
      "The doctrine of the Holy Trinity is central to Orthodox Christianity. Understanding the relationship between the Father, the Son, and the Holy Spirit is foundational to our faith and worship...",
    category: "Theology",
    authorName: "Aba Gorgorios",
    publishAt: null,
    createdAt: null,
  },
  {
    id: "3",
    title: "Community Prayer: Strengthening Our Bond in Faith",
    content:
      "There is profound power in gathering together in prayer. When our community comes together to lift our voices and hearts to God, we experience a spiritual unity that transcends individual worship...",
    category: "Community",
    authorName: "Aba Gorgorios",
    publishAt: null,
    createdAt: null,
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative min-h-[92vh] flex items-center overflow-hidden bg-[#1B2E6B]">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 50%, #F5C518 0%, transparent 50%), radial-gradient(circle at 80% 20%, #ffffff 0%, transparent 40%)",
            }}
          />
        </div>
        {/* Cross watermark */}
        <div className="absolute right-[-80px] top-1/2 -translate-y-1/2 text-white/5 select-none pointer-events-none hidden lg:block">
          <span className="text-[400px] font-thin leading-none">✝</span>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32 grid lg:grid-cols-2 gap-16 items-center">
          {/* Text */}
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 text-white/80 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F5C518] animate-pulse" />
              Ethiopian Orthodox Ministry · Dubai
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              Walk in Faith,{" "}
              <span className="text-[#F5C518]">Grow in Spirit</span>
            </h1>
            <p className="text-white/70 text-lg leading-relaxed mb-8 max-w-lg">
              Nablis Ministry offers spiritual guidance, confession, Bible study, and community
              support rooted in the rich traditions of the Ethiopian Orthodox Tewahedo Church.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 bg-[#F5C518] text-[#1B2E6B] font-semibold px-6 py-3.5 rounded-xl hover:bg-[#e6b800] active:bg-[#d4a900] transition-colors"
              >
                <Calendar size={17} />
                Book Appointment
              </Link>
              <Link
                href="/blog"
                className="inline-flex items-center justify-center gap-2 bg-white/10 text-white font-semibold px-6 py-3.5 rounded-xl hover:bg-white/20 transition-colors border border-white/20"
              >
                <BookOpen size={17} />
                Read Teachings
              </Link>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 mt-10 pt-8 border-t border-white/10">
              {[
                { label: "Community Members", value: "500+" },
                { label: "Years of Ministry", value: "15+" },
                { label: "Sessions Monthly", value: "40+" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-2xl font-bold text-[#F5C518]">{value}</p>
                  <p className="text-white/50 text-xs mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Hero card */}
          <div className="hidden lg:block">
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-[#F5C518] flex items-center justify-center flex-shrink-0">
                  <span className="text-[#1B2E6B] font-bold text-3xl leading-none">ን</span>
                </div>
                <div>
                  <p className="text-white font-bold text-lg">ናቡስ Ministry</p>
                  <p className="text-white/50 text-sm">Ethiopian Orthodox • Dubai</p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { icon: "🕊️", text: "Private Confession Sessions" },
                  { icon: "📖", text: "Weekly Bible Study Groups" },
                  { icon: "🙏", text: "Spiritual Counseling & Guidance" },
                  { icon: "✨", text: "Youth Faith Programs" },
                  { icon: "🎵", text: "Community Prayer & Worship" },
                ].map(({ icon, text }) => (
                  <div
                    key={text}
                    className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3"
                  >
                    <span className="text-lg">{icon}</span>
                    <span className="text-white/80 text-sm">{text}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-5 border-t border-white/10 flex items-center gap-3">
                <Phone size={14} className="text-[#F5C518]" />
                <span className="text-white/70 text-sm">+971 56 498 3456</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Spiritual Father */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            {/* Photo placeholder */}
            <div className="relative">
              <div className="aspect-[4/5] rounded-3xl overflow-hidden bg-gradient-to-br from-[#1B2E6B] to-[#2a4499] flex items-center justify-center max-w-sm mx-auto lg:mx-0">
                <span className="text-white/20 text-9xl">🙏</span>
              </div>
              {/* Accent badge */}
              <div className="absolute bottom-6 right-0 lg:-right-6 bg-[#F5C518] text-[#1B2E6B] rounded-2xl px-5 py-3 shadow-lg">
                <p className="font-bold text-sm">Aba Gorgorios</p>
                <p className="text-xs font-medium opacity-80">Spiritual Father</p>
              </div>
            </div>

            {/* Bio */}
            <div>
              <p className="text-[#F5C518] font-semibold text-sm uppercase tracking-widest mb-3">
                Meet Our Spiritual Father
              </p>
              <h2 className="text-3xl lg:text-4xl font-bold text-[#1B2E6B] mb-5 leading-tight">
                Aba Gorgorios — Guiding with Wisdom & Compassion
              </h2>
              <p className="text-[#6B7280] leading-relaxed mb-5">
                With over 15 years of dedicated ministry, Aba Gorgorios has been a beacon of
                faith for the Ethiopian Orthodox community in Dubai. Ordained in the Ethiopian
                Orthodox Tewahedo Church, he brings deep theological knowledge and heartfelt
                compassion to every spiritual encounter.
              </p>
              <p className="text-[#6B7280] leading-relaxed mb-8">
                His ministry focuses on individual spiritual growth, family counseling, and
                building a strong community of faith far from home. Whether through private
                confession, group Bible study, or community prayer, Aba Gorgorios walks
                alongside every member of his flock.
              </p>
              <div className="grid grid-cols-2 gap-4 mb-8">
                {[
                  { label: "Ordained", value: "2009" },
                  { label: "Location", value: "Dubai, UAE" },
                  { label: "Specialization", value: "Counseling" },
                  { label: "Language", value: "Amharic · Arabic · English" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[#EEF1F8] rounded-xl p-4">
                    <p className="text-[#9CA3AF] text-xs mb-1">{label}</p>
                    <p className="text-[#1B2E6B] font-semibold text-sm">{value}</p>
                  </div>
                ))}
              </div>
              <Link
                href="/about"
                className="inline-flex items-center gap-2 text-[#1B2E6B] font-semibold hover:text-[#F5C518] transition-colors"
              >
                Learn more about our ministry
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Services Preview */}
      <section className="py-20 bg-[#EEF1F8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-[#F5C518] font-semibold text-sm uppercase tracking-widest mb-2">
              Our Services
            </p>
            <h2 className="text-3xl lg:text-4xl font-bold text-[#1B2E6B] mb-4">
              How We Can Serve You
            </h2>
            <p className="text-[#6B7280] max-w-2xl mx-auto">
              From private confession to community Bible study, we offer a range of spiritual
              services to support your journey of faith.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SERVICES.map((s) => (
              <ServiceCard key={s.title} {...s} />
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              href="/services"
              className="inline-flex items-center gap-2 text-[#1B2E6B] font-semibold hover:text-[#F5C518] transition-colors"
            >
              View all services
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Blogs */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <p className="text-[#F5C518] font-semibold text-sm uppercase tracking-widest mb-2">
                Teachings & Reflections
              </p>
              <h2 className="text-3xl font-bold text-[#1B2E6B]">Latest from the Blog</h2>
            </div>
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-[#1B2E6B] font-semibold hover:text-[#F5C518] transition-colors flex-shrink-0"
            >
              View all posts
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SAMPLE_BLOGS.map((post) => (
              <BlogCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      </section>

      {/* Download App CTA */}
      <section className="py-20 bg-[#1B2E6B] relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 80% 50%, #F5C518 0%, transparent 60%)",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#F5C518] flex items-center justify-center mx-auto mb-6">
            <span className="text-[#1B2E6B] font-bold text-3xl leading-none">ን</span>
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            Take Your Faith With You
          </h2>
          <p className="text-white/60 max-w-xl mx-auto mb-8">
            Download the Nablis app for daily prayers, teachings, event reminders, and direct
            connection to your spiritual community — wherever you are.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#"
              className="inline-flex items-center gap-2.5 bg-white text-[#1B2E6B] font-semibold px-6 py-3.5 rounded-xl hover:bg-[#F5C518] transition-colors"
            >
              <Download size={17} />
              App Store
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-2.5 bg-white/10 text-white font-semibold px-6 py-3.5 rounded-xl hover:bg-white/20 transition-colors border border-white/20"
            >
              <Download size={17} />
              Google Play
            </a>
          </div>
          <p className="text-white/30 text-xs mt-6">Coming soon · Stay tuned for the launch</p>
        </div>
      </section>

      {/* Contact bar */}
      <section className="py-10 bg-[#EEF1F8] border-t border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
          <a
            href="tel:+971564983456"
            className="flex items-center gap-3 text-[#1B2E6B] hover:text-[#F5C518] transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-[#1B2E6B] flex items-center justify-center flex-shrink-0">
              <Phone size={15} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-[#9CA3AF]">Call us</p>
              <p className="font-semibold text-sm">+971 56 498 3456</p>
            </div>
          </a>
          <a
            href="mailto:info@nablis.com"
            className="flex items-center gap-3 text-[#1B2E6B] hover:text-[#F5C518] transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-[#1B2E6B] flex items-center justify-center flex-shrink-0">
              <Mail size={15} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-[#9CA3AF]">Email us</p>
              <p className="font-semibold text-sm">info@nablis.com</p>
            </div>
          </a>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 bg-[#F5C518] text-[#1B2E6B] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#e6b800] transition-colors"
          >
            <Calendar size={15} />
            Book a Session
          </Link>
        </div>
      </section>
    </>
  );
}
