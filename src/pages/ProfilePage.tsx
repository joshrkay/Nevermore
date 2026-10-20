import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RavenLogo } from "@/components/RavenLogo";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const ProfilePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    phone: "",
    employee_count: "",
  });

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("company_name, contact_name, phone, employee_count")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setForm({
          company_name: data.company_name ?? "",
          contact_name: data.contact_name ?? "",
          phone: data.phone ?? "",
          employee_count: data.employee_count?.toString() ?? "",
        });
      }
      if (error) console.error("Error fetching profile:", error);
      setLoading(false);
    };
    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        company_name: form.company_name.trim() || null,
        contact_name: form.contact_name.trim() || null,
        phone: form.phone.trim() || null,
        employee_count: form.employee_count ? parseInt(form.employee_count, 10) : null,
      })
      .eq("user_id", user.id);

    setSaving(false);
    if (error) {
      toast.error("Failed to save profile");
      console.error(error);
    } else {
      toast.success("Profile updated");
    }
  };

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <RavenLogo className="w-7 h-7 text-primary" />
            <span className="font-display text-lg text-foreground">Profile Settings</span>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:block">{user?.email}</span>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-10 max-w-xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Company Profile</CardTitle>
              <CardDescription className="text-muted-foreground">
                Update your company information. This data is used when generating PEO proposals.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="company_name" className="text-foreground">Company Name</Label>
                <Input
                  id="company_name"
                  placeholder="Acme Corp"
                  value={form.company_name}
                  onChange={(e) => handleChange("company_name", e.target.value)}
                  className="bg-background border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_name" className="text-foreground">Contact Name</Label>
                <Input
                  id="contact_name"
                  placeholder="Jane Doe"
                  value={form.contact_name}
                  onChange={(e) => handleChange("contact_name", e.target.value)}
                  className="bg-background border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-foreground">Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="(555) 123-4567"
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  className="bg-background border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employee_count" className="text-foreground">Employee Count</Label>
                <Input
                  id="employee_count"
                  type="number"
                  placeholder="25"
                  value={form.employee_count}
                  onChange={(e) => handleChange("employee_count", e.target.value)}
                  className="bg-background border-border"
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full mt-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default ProfilePage;
