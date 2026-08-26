import { Quote } from "lucide-react";

interface TestimonialCardProps {
  quote: string;
  name: string;
  project: string;
}

const TestimonialCard = ({ quote, name, project }: TestimonialCardProps) => {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <Quote className="h-8 w-8 text-primary/30 mb-3" />
      <p className="text-body text-foreground mb-4 italic">"{quote}"</p>
      <div>
        <p className="font-semibold text-foreground">{name}</p>
        <p className="text-small text-muted-foreground">{project}</p>
      </div>
    </div>
  );
};

export default TestimonialCard;
