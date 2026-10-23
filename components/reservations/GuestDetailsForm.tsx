import { User, Phone, Mail, MessageSquare } from "lucide-react";

export interface GuestDetailsData {
  customerName: string;
  email: string;
  phone: string;
  specialRequest: string;
}

interface GuestDetailsFormProps {
  data: GuestDetailsData;
  onChange: (data: GuestDetailsData) => void;
  primaryColor?: string;
  showSpecialRequest?: boolean;
}

export function GuestDetailsForm({
  data,
  onChange,
  primaryColor = "#000000",
  showSpecialRequest = true,
}: GuestDetailsFormProps) {
  const handleChange = (field: keyof GuestDetailsData, value: string) => {
    const nextValue = field === "customerName"
      ? value.replace(/^(\s*)(\S)/, (_, spaces, first) => `${spaces}${first.toUpperCase()}`)
      : value;
    onChange({ ...data, [field]: nextValue });
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        {/* Full name */}
        <div>
          <label className="flex items-center gap-2 text-sm font-bold text-foreground mb-2">
            <User className="w-4 h-4" style={{ color: primaryColor }} />
            Full Name <span className="text-destructive">*</span>
          </label>
          <input
            required
            type="text"
            value={data.customerName}
            onChange={(e) => handleChange("customerName", e.target.value)}
            className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none text-foreground font-medium"
            placeholder="e.g. John Doe"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="flex items-center gap-2 text-sm font-bold text-foreground mb-2">
            <Phone className="w-4 h-4" style={{ color: primaryColor }} />
            Phone Number <span className="text-destructive">*</span>
          </label>
          <input
            required
            type="tel"
            value={data.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none text-foreground font-medium"
            placeholder="+1 (555) 000-0000"
          />
        </div>

        {/* Email */}
        <div>
          <label className="flex items-center gap-2 text-sm font-bold text-foreground mb-2">
            <Mail className="w-4 h-4" style={{ color: primaryColor }} />
            Email Address <span className="text-destructive">*</span>
          </label>
          <input
            required
            type="email"
            value={data.email}
            onChange={(e) => handleChange("email", e.target.value)}
            className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none text-foreground font-medium"
            placeholder="john@example.com"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Confirmation details will be sent here if provided.
          </p>
        </div>
      </div>

      {showSpecialRequest && (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <label className="flex items-center gap-2 text-sm font-bold text-foreground mb-3">
            <MessageSquare className="w-4 h-4" style={{ color: primaryColor }} />
            Special Requests
            <span className="text-muted-foreground font-normal text-xs">
              (Optional)
            </span>
          </label>
          <textarea
            name="specialRequest"
            value={data.specialRequest}
            onChange={(e) => handleChange("specialRequest", e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none text-sm text-foreground resize-none"
            placeholder="Allergies, accessibility needs, late check-in…"
          />
          <p className="text-xs text-muted-foreground text-right mt-1">
            {data.specialRequest.length}/500
          </p>
        </div>
      )}
    </div>
  );
}
