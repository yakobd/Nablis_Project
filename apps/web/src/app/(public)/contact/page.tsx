"use client";
import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Phone, Mail, MapPin, Clock, Send, CheckCircle, AlertCircle } from "lucide-react";

type Status = "idle" | "sending" | "success" | "error";

const SERVICE_OPTIONS = [
  "Confession",
  "Spiritual Counseling",
  "Marriage Guidance",
  "Group Bible Study",
  "Youth Guidance",
  "General Inquiry",
  "Other",
];

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    service: "",
    message: "",
  });
  const [status, setStatus] = useState<Status>("idle");

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    setStatus("sending");
    try {
      await addDoc(collection(db, "messages"), {
        senderName: form.name.trim(),
        senderEmail: form.email.trim(),
        senderPhone: form.phone.trim(),
        serviceType: form.service,
        body: form.message.trim(),
        read: false,
        createdAt: serverTimestamp(),
        source: "contact_form",
      });
      setStatus("success");
      setForm({ name: "", email: "", phone: "", service: "", message: "" });
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      {/* Hero */}
      <section className="bg-[#1B2E6B] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-[#F5C518] font-semibold text-sm uppercase tracking-widest mb-3">
            Contact Us
          </p>
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-5 leading-tight">
            We&apos;re Here for You
          </h1>
          <p className="text-white/60 max-w-2xl mx-auto text-lg leading-relaxed">
            Reach out to book an appointment, ask a question, or simply connect with our
            community. We respond within 24 hours.
          </p>
        </div>
      </section>

      <section className="py-16 bg-[#EEF1F8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-3 gap-10">
          {/* Contact info */}
          <div className="space-y-5">
            {/* Info cards */}
            {[
              {
                icon: <Phone size={18} className="text-[#F5C518]" />,
                label: "Phone",
                value: "+971 56 498 3456",
                href: "tel:+971564983456",
              },
              {
                icon: <Mail size={18} className="text-[#F5C518]" />,
                label: "Email",
                value: "info@nablis.com",
                href: "mailto:info@nablis.com",
              },
              {
                icon: <MapPin size={18} className="text-[#F5C518]" />,
                label: "Location",
                value: "Dubai, United Arab Emirates",
                href: undefined,
              },
            ].map(({ icon, label, value, href }) => (
              <div
                key={label}
                className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-sm flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-[#EEF1F8] flex items-center justify-center flex-shrink-0">
                  {icon}
                </div>
                <div>
                  <p className="text-[#9CA3AF] text-xs mb-0.5">{label}</p>
                  {href ? (
                    <a
                      href={href}
                      className="text-[#1B2E6B] font-semibold text-sm hover:text-[#F5C518] transition-colors"
                    >
                      {value}
                    </a>
                  ) : (
                    <p className="text-[#1B2E6B] font-semibold text-sm">{value}</p>
                  )}
                </div>
              </div>
            ))}

            {/* Hours */}
            <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#EEF1F8] flex items-center justify-center flex-shrink-0">
                  <Clock size={18} className="text-[#F5C518]" />
                </div>
                <p className="text-[#1B2E6B] font-semibold text-sm">Office Hours</p>
              </div>
              <div className="space-y-2">
                {[
                  { day: "Sunday", time: "9:00 AM – 1:00 PM" },
                  { day: "Wednesday", time: "6:30 PM – 9:00 PM" },
                  { day: "Saturday", time: "9:00 AM – 12:00 PM" },
                  { day: "By Appointment", time: "Mon – Fri" },
                ].map(({ day, time }) => (
                  <div key={day} className="flex justify-between text-xs">
                    <span className="text-[#9CA3AF]">{day}</span>
                    <span className="text-[#374151] font-medium">{time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Note */}
            <div className="bg-[#1B2E6B] rounded-2xl p-5 text-white">
              <p className="text-[#F5C518] font-semibold text-sm mb-2">Need urgent help?</p>
              <p className="text-white/70 text-sm leading-relaxed">
                For urgent spiritual matters, please call us directly. Aba Gorgorios is
                available for pastoral emergencies outside regular hours.
              </p>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-8 border border-[#E5E7EB] shadow-sm">
            <h2 className="text-xl font-bold text-[#1B2E6B] mb-1">Send a Message</h2>
            <p className="text-[#9CA3AF] text-sm mb-6">
              Fill out the form below and we&apos;ll get back to you as soon as possible.
            </p>

            {status === "success" ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-4">
                  <CheckCircle size={32} className="text-green-500" />
                </div>
                <h3 className="text-[#1B2E6B] font-bold text-lg mb-2">Message Sent!</h3>
                <p className="text-[#6B7280] text-sm max-w-xs leading-relaxed">
                  Thank you for reaching out. We&apos;ll be in touch with you within 24 hours.
                </p>
                <button
                  onClick={() => setStatus("idle")}
                  className="mt-6 text-sm text-[#1B2E6B] font-semibold hover:text-[#F5C518] transition-colors"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                      Full Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      required
                      placeholder="Your full name"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                      Email Address <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      required
                      placeholder="you@example.com"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="+971 5X XXX XXXX"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                      Service Type
                    </label>
                    <select
                      name="service"
                      value={form.service}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors bg-white"
                    >
                      <option value="">Select a service…</option>
                      {SERVICE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                    Message <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    required
                    rows={5}
                    placeholder="Tell us how we can help or what you'd like to discuss…"
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors resize-none"
                  />
                </div>

                {status === "error" && (
                  <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 rounded-xl px-4 py-3">
                    <AlertCircle size={16} />
                    Something went wrong. Please try again or contact us directly.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="w-full flex items-center justify-center gap-2 bg-[#F5C518] text-[#1B2E6B] font-semibold py-3 rounded-xl hover:bg-[#e6b800] active:bg-[#d4a900] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {status === "sending" ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[#1B2E6B]/40 border-t-[#1B2E6B] rounded-full animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Send Message
                    </>
                  )}
                </button>

                <p className="text-[#9CA3AF] text-xs text-center">
                  We respect your privacy. Your information will only be used to respond to
                  your inquiry.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
