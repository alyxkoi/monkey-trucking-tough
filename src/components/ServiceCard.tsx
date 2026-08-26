import { LucideIcon } from "lucide-react";

interface ServiceCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

const ServiceCard = ({ icon: Icon, title, description }: ServiceCardProps) => {
  return (
    <div className="service-industrial-panel rounded-sm p-3 md:p-6 transition-all duration-300 hover:-translate-y-1.5 group cursor-default">
      <div className="w-10 h-10 md:w-16 md:h-16 rounded-sm bg-primary/15 flex items-center justify-center mb-2 md:mb-5 group-hover:bg-primary/25 transition-colors">
        <Icon className="h-5 w-5 md:h-8 md:w-8 text-primary" />
      </div>
      <h3 className="font-heading text-base md:text-[1.2rem] tracking-wide text-foreground mb-1 md:mb-2 group-hover:text-primary transition-colors">{title}</h3>
      <p className="text-body text-muted-foreground">{description}</p>
    </div>
  );
};

export default ServiceCard;
