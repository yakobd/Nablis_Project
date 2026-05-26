import React from "react";
import Link from "next/link";
import { Calendar, ArrowRight } from "lucide-react";

const VALUES = [
  {
    icon: "📖",
    title: "Scripture & Tradition",
    description:
      "We are rooted in the Holy Bible and the rich liturgical traditions of the Ethiopian Orthodox Tewahedo Church, passed down for over 1,600 years.",
  },
  {
    icon: "🤝",
    title: "Community & Belonging",
    description:
      "We nurture a welcoming community where every member — regardless of background — finds spiritual family, support, and belonging.",
  },
  {
    icon: "🕊️",
    title: "Compassionate Guidance",
    description:
      "Our ministry is built on empathy and understanding, offering pastoral care that meets people where they are in their spiritual journey.",
  },
  {
    icon: "✨",
    title: "Spiritual Growth",
    description:
      "Through prayer, fasting, study, and sacramental life, we walk alongside our members as they deepen their relationship with God.",
  },
];

const TIMELINE = [
  {
    year: "2009",
    title: "Ordination",
    description: "መጋቢ ሐዲስ ቀሲስ ሳሙኤል አያልነህ(ዶ/ር) was ordained as a priest in the Ethiopian Orthodox Tewahedo Church.",
  },
  {
    year: "2012",
    title: "Arrival in Dubai",
    description:
      "Responding to the growing Ethiopian diaspora in the UAE, መጋቢ ሐዲስ ቀሲስ ሳሙኤል አያልነህ(ዶ/ር) was sent to Dubai to serve the community.",
  },
  {
    year: "2015",
    title: "Community Foundation",
    description:
      "Established regular weekly gatherings, confession sessions, and Bible study groups for the growing community.",
  },
  {
    year: "2018",
    title: "Youth Program Launch",
    description:
      "Launched the Nablis Youth Faith Program to nurture the next generation of Orthodox Christians in the diaspora.",
  },
  {
    year: "2022",
    title: "Nablis Ministry",
    description:
      "Officially established Nablis Ministry as a structured platform to serve hundreds of community members across Dubai.",
  },
  {
    year: "2024",
    title: "Digital Expansion",
    description:
      "Launched the Nablis app and digital platform to reach members across the UAE and beyond.",
  },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-[#1B2E6B] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-[#F5C518] font-semibold text-sm uppercase tracking-widest mb-3">
            About Us
          </p>
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-5 leading-tight">
            Our Mission & Story
          </h1>
          <p className="text-white/60 max-w-2xl mx-auto text-lg leading-relaxed">
            Nablis Ministry is a home for the Ethiopian Orthodox Tewahedo community in Dubai —
            a place of prayer, healing, teaching, and belonging.
          </p>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-10">
          <div className="bg-[#EEF1F8] rounded-3xl p-8 lg:p-10">
            <div className="w-12 h-12 rounded-2xl bg-[#1B2E6B] flex items-center justify-center mb-5">
              <span className="text-[#F5C518] font-bold text-xl leading-none">ን</span>
            </div>
            <h2 className="text-2xl font-bold text-[#1B2E6B] mb-3">Our Mission</h2>
            <p className="text-[#6B7280] leading-relaxed">
              To provide the Ethiopian Orthodox community in Dubai with authentic spiritual care,
              pastoral guidance, and a strong sense of community — preserving our faith and
              culture while supporting one another far from home.
            </p>
          </div>
          <div className="bg-[#1B2E6B] rounded-3xl p-8 lg:p-10">
            <div className="w-12 h-12 rounded-2xl bg-[#F5C518] flex items-center justify-center mb-5">
              <span className="text-[#1B2E6B] text-2xl">🌟</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Our Vision</h2>
            <p className="text-white/70 leading-relaxed">
              A thriving, spiritually grounded Ethiopian Orthodox community in the UAE that
              keeps the faith alive across generations — where every member knows they are
              seen, supported, and growing in God&apos;s grace.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-[#EEF1F8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-[#F5C518] font-semibold text-sm uppercase tracking-widest mb-2">
              What We Stand For
            </p>
            <h2 className="text-3xl font-bold text-[#1B2E6B]">Our Core Values</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {VALUES.map(({ icon, title, description }) => (
              <div
                key={title}
                className="bg-white rounded-2xl p-6 border border-[#E5E7EB] shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="text-3xl mb-4">{icon}</div>
                <h3 className="text-[#1B2E6B] font-semibold text-base mb-2">{title}</h3>
                <p className="text-[#6B7280] text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Spiritual Father Bio */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-14 items-start">
            {/* Photo */}
            <div className="relative max-w-sm mx-auto lg:mx-0 w-full">
              <div className="aspect-[3/4] rounded-3xl overflow-hidden bg-gradient-to-br from-[#1B2E6B] to-[#2a4499] flex items-center justify-center">
                <span className="text-white/20 text-9xl">🙏</span>
              </div>
              <div className="absolute -bottom-4 -right-4 bg-[#F5C518] rounded-2xl px-6 py-4 shadow-xl">
                <p className="text-[#1B2E6B] font-bold">15+ Years</p>
                <p className="text-[#1B2E6B] text-xs font-medium">of Ministry</p>
              </div>
            </div>

            {/* Bio + Timeline */}
            <div>
              <p className="text-[#F5C518] font-semibold text-sm uppercase tracking-widest mb-2">
                Our Spiritual Father
              </p>
              <h2 className="text-3xl font-bold text-[#1B2E6B] mb-4">መጋቢ ሐዲስ ቀሲስ ሳሙኤል አያልነህ(ዶ/ር)</h2>
              <p className="text-[#6B7280] leading-relaxed mb-4">
                መጋቢ ሐዲስ ቀሲስ ሳሙኤል አያልነህ(ዶ/ር) is a devoted priest of the Ethiopian Orthodox Tewahedo Church with
                deep theological training and a lifelong commitment to pastoral care. Born and
                raised in Ethiopia, he studied theology at a renowned Orthodox seminary before
                being ordained in 2009.
              </p>
              <p className="text-[#6B7280] leading-relaxed mb-8">
                His journey to Dubai in 2012 was driven by a calling to serve the Ethiopian
                diaspora — to ensure that community members living abroad have access to the
                sacraments, spiritual guidance, and the warmth of Orthodox community life. Today,
                he leads a growing congregation with humility, wisdom, and unwavering faith.
              </p>

              {/* Timeline */}
              <div className="space-y-0">
                {TIMELINE.map(({ year, title, description }, i) => (
                  <div key={year} className="flex gap-5">
                    {/* Line */}
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-[#F5C518] flex-shrink-0 mt-1" />
                      {i < TIMELINE.length - 1 && (
                        <div className="w-0.5 bg-[#E5E7EB] flex-1 my-1" />
                      )}
                    </div>
                    <div className="pb-6">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[#F5C518] font-bold text-sm">{year}</span>
                        <span className="text-[#1B2E6B] font-semibold text-sm">{title}</span>
                      </div>
                      <p className="text-[#6B7280] text-sm leading-relaxed">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-[#EEF1F8] border-t border-[#E5E7EB]">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-[#1B2E6B] mb-3">
            Ready to Connect with Our Community?
          </h2>
          <p className="text-[#6B7280] mb-6">
            Whether you need spiritual guidance, want to join a Bible study group, or simply
            wish to be part of our community — we welcome you.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 bg-[#F5C518] text-[#1B2E6B] font-semibold px-6 py-3 rounded-xl hover:bg-[#e6b800] transition-colors"
            >
              <Calendar size={16} />
              Book Appointment
            </Link>
            <Link
              href="/services"
              className="inline-flex items-center justify-center gap-2 bg-white text-[#1B2E6B] font-semibold px-6 py-3 rounded-xl border border-[#E5E7EB] hover:border-[#1B2E6B] transition-colors"
            >
              View Services
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
