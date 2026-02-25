import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface EarlyAccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormData {
  name: string;
  company: string;
  email: string;
  useCase: string;
}

const initialFormData: FormData = {
  name: "",
  company: "",
  email: "",
  useCase: "",
};

const EarlyAccessModal = ({ open, onOpenChange }: EarlyAccessModalProps) => {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setFormData(initialFormData);
      setSubmitted(false);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        {submitted ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600/10">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-6 w-6 text-blue-500"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <DialogHeader>
              <DialogTitle className="text-center text-xl">
                Thank you!
              </DialogTitle>
              <DialogDescription className="text-center">
                We&apos;ve received your request. Our team will be in touch
                shortly with access details.
              </DialogDescription>
            </DialogHeader>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Request Early Access</DialogTitle>
              <DialogDescription>
                Fill in your details and we&apos;ll get you set up with the full
                platform — interactive map, 10-year timeline, and automated
                intelligence.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-4 pt-2">
              <div className="grid gap-2">
                <Label htmlFor="ea-name">Name</Label>
                <Input
                  id="ea-name"
                  name="name"
                  placeholder="Jane Smith"
                  required
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ea-company">Company</Label>
                <Input
                  id="ea-company"
                  name="company"
                  placeholder="Acme Restaurants"
                  required
                  value={formData.company}
                  onChange={handleChange}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ea-email">Email</Label>
                <Input
                  id="ea-email"
                  name="email"
                  type="email"
                  placeholder="jane@acme.com"
                  required
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ea-usecase">
                  Role / use case{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  id="ea-usecase"
                  name="useCase"
                  placeholder="e.g. Expansion analyst looking for competitive gaps in the North West"
                  rows={3}
                  value={formData.useCase}
                  onChange={handleChange}
                />
              </div>
              <Button
                type="submit"
                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Submit Request
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EarlyAccessModal;
