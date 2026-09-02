import { useId, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import ResponsiveImage from "@/components/public/ResponsiveImage";

type ComparisonImage = {
  src: string;
  mobileSrc?: string;
  alt: string;
};

type BeforeAfterSliderProps = {
  before: ComparisonImage;
  after: ComparisonImage;
};

export default function BeforeAfterSlider({ before, after }: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(50);
  const instructionId = useId();

  return (
    <div className="driveway-comparison">
      <div className="driveway-comparison-heading">
        <h2 className="font-heading">Before + after</h2>
        <p id={instructionId}>Drag to compare</p>
      </div>

      <div className="driveway-comparison-stage">
        <ResponsiveImage src={after.src} mobileSrc={after.mobileSrc} alt={after.alt} loading="eager" decoding="async" draggable={false} className="driveway-comparison-image" />
        <div className="driveway-comparison-before" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
          <ResponsiveImage src={before.src} mobileSrc={before.mobileSrc} alt={before.alt} loading="eager" decoding="async" draggable={false} className="driveway-comparison-image" />
        </div>
        <span className="driveway-comparison-label driveway-comparison-label-before">Before</span>
        <span className="driveway-comparison-label driveway-comparison-label-after">After</span>
        <input
          type="range"
          min="0"
          max="100"
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          className="driveway-comparison-range"
          aria-label="Compare before and after driveway photos"
          aria-describedby={instructionId}
          aria-valuetext={`${position}% of the before photo visible`}
        />
        <span className="driveway-comparison-divider" style={{ left: `${position}%` }} aria-hidden="true">
          <span className="driveway-comparison-handle"><ArrowLeftRight /></span>
        </span>
      </div>
    </div>
  );
}
