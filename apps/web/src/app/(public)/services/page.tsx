import React from "react";
import Link from "next/link";
import { ServiceCard } from "@/components/public/ServiceCard";
import { Calendar, Phone, Mail } from "lucide-react";

const SERVICES = [
  {
    icon: <span className="text-2xl">🕊️</span>,
    title: "Confession",
    description:
      "Private one-on-one confession sessions with Aba Gorgorios. Confession is a holy sacrament through which we receive forgiveness, healing, and spiritual renewal in the Orthodox tradition.",
    audience: "All baptized Orthodox Christians",
    features: [
      "Completely private & confidential",
      "By appointment only",
      "Available on weekdays and Saturday mornings",
      "Duration: 30–60 minutes",
    ],
    href: "/contact",
    accentColor: "#1B2E6B",
  },
  {
    icon: <span className="text-2xl">🙏</span>,
    title: "Spiritual Counseling",
    description:
      "Personalized one-on-one or couples counseling rooted in Orthodox Christian faith and psychology. Helps navigate life challenges, grief, family struggles, and personal spiritual crises.",
    audience: "Individuals, couples & families",
    features: [
      "Individual & couples sessions",
      "Marriage preparation & guidance",
      "Grief and crisis counseling",
      "Ongoing spiritual direction",
    ],
    href: "/contact",
    accentColor: "#2a6b3b",
  },
  {
    icon: <span className="text-2xl">📖</span>,
    title: "Group Bible Study",
    description:
      "Weekly community-based exploration of the Holy Scriptures guided by Aba Gorgorios. Sessions are interactive, educational, and open to all levels of Orthodox knowledge.",
    audience: "All community members",
    features: [
      "Every Wednesday evening",
      "Amharic & English mixed",
      "All experience levels welcome",
      "Study materials provided",
    ],
    href: "/contact",
    accentColor: "#7b3f00",
  },
  {
    icon: <span className="text-2xl">✨</span>,
    title: "Youth Guidance",
    description:
      "Programs and mentorship dedicated to nurturing the faith of young Ethiopian Orthodox Christians growing up in the diaspora, helping them stay connected to their heritage and God.",
    audience: "Youth ages 13–25",
    features: [
      "Monthly youth gatherings",
      "Orthodox catechism classes",
      "Community service projects",
      "Mentorship by senior members",
    ],
    href: "/contact",
    accentColor: "#6b1b6b",
  },
];

const PROCESS = [
  {
    step: "01",
    title: "Book an Appointment",
    description:
      "Contact us through the form, phone, or email to request an appointment for any of our services.",
  },
  {
    step: "02",
    title: "Confirmation",
    description:
      "We'll confirm your appointment within 24 hours and provide any preparation guidance relevant to your session.",
  },
  {
    step: "03",
    title: "Attend Your Session",
    description:
      "Come to your appointment with an open heart. All sessions are held in a private, sacred, and welcoming environment.",
  },
  {
    step: "04",
    title: "Ongoing Support",
    description:
      "After your session, Aba Gorgorios remains available for follow-up guidance as part of our ongoing pastoral care.",
  },
];

export default function ServicesPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-[#1B2E6B] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-[#F5C518] font-semibold text-sm uppercase tracking-widest mb-3">
            Our Services
          </p>
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-5 leading-tight">
            Spiritual Services for Every Need
          </h1>
          <p className="text-white/60 max-w-2xl mx-auto text-lg leading-relaxed">
            From the sacrament of confession to youth mentorship, we offer a full range of
            pastoral services to support your spiritual journey.
          </p>
        </div>
      </section>

      {/* Service Cards */}
      <section className="py-20 bg-[#EEF1F8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {SERVICES.map((s) => (
              <ServiceCard key={s.title} {...s} />
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-[#F5C518] font-semibold text-sm uppercase tracking-widest mb-2">
              Simple Process
            </p>
            <h2 className="text-3xl font-bold text-[#1B2E6B]">How to Get Started</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {PROCESS.map(({ step, title, description }) => (
              <div key={step} className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#1B2E6B] text-[#F5C518] font-bold text-lg flex items-center justify-center mx-auto mb-5">
                  {step}
                </div>
                <h3 className="text-[#1B2E6B] font-semibold text-base mb-2">{title}</h3>
                <p className="text-[#6B7280] text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Schedule info */}
      <section className="py-16 bg-[#EEF1F8]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-3xl p-8 lg:p-10 border border-[#E5E7EB] shadow-sm">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-2xl font-bold text-[#1B2E6B] mb-4">
                  Service Schedule
                </h2>
                <div className="space-y-3">
                  {[
                    { day: "Sunday", detail: "Community Prayer & Liturgy — 9:00 AM" },
                    { day: "Wednesday", detail: "Group Bible Study — 7:00 PM" },
                    { day: "Saturday", detail: "Confession Sessions — 9:00 AM – 12:00 PM" },
                    { day: "By Appointment", detail: "Counseling & Private Sessions" },
                  ].map(({ day, detail }) => (
                    <div key={day} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-[#F5C518] mt-1.5 flex-shrink-0" />
                      <div>
                        <span className="text-[#1B2E6B] font-semibold text-sm">{day}:</span>{" "}
                        <span className="text-[#6B7280] text-sm">{detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-[#EEF1F8] rounded-2xl p-6">
                <h3 className="text-[#1B2E6B] font-bold text-base mb-4">Book an Appointment</h3>
                <p className="text-[#6B7280] text-sm mb-5 leading-relaxed">
                  All services are by appointment. Contact us to schedule your session or
                  join one of our regular community gatherings.
                </p>
                <div className="space-y-3 mb-5">
                  <a
                    href="tel:+971564983456"
                    className="flex items-center gap-2.5 text-[#1B2E6B] hover:text-[#F5C518] transition-colors"
                  >
                    <Phone size={14} className="text-[#F5C518]" />
                    <span className="text-sm font-medium">+971 56 498 3456</span>
                  </a>
                  <a
                    href="mailto:info@nablis.com"
                    className="flex items-center gap-2.5 text-[#1B2E6B] hover:text-[#F5C518] transition-colors"
                  >
                    <Mail size={14} className="text-[#F5C518]" />
                    <span className="text-sm font-medium">info@nablis.com</span>
                  </a>
                </div>
                <Link
                  href="/contact"
                  className="w-full flex items-center justify-center gap-2 bg-[#F5C518] text-[#1B2E6B] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#e6b800] transition-colors text-sm"
                >
                  <Calendar size={14} />
                  Book Online
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
