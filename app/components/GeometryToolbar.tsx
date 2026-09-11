'use client';

type SnapStep = 0 | 10 | 50 | 100;

type Props = {
  snapStep: SnapStep;
  onSnapStepChange: (step: SnapStep) => void;
  orthogonal: boolean;
  onOrthogonalChange: (enabled: boolean) => void;
};

const steps: { value: SnapStep; label: string }[] = [
  { value: 0, label: 'Выкл.' },
  { value: 10, label: '10 мм' },
  { value: 50, label: '50 мм' },
  { value: 100, label: '100 мм' },
];

export default function GeometryToolbar({
  snapStep,
  onSnapStepChange,
  orthogonal,
  onOrthogonalChange,
}: Props) {
  return (
    <div className="geometry-toolbar" aria-label="Инструменты геометрии">
      <div className="geometry-control">
        <span className="geometry-control-label">Привязка</span>
        <div className="geometry-segmented" role="group" aria-label="Шаг привязки">
          {steps.map((step) => (
            <button
              key={step.value}
              type="button"
              className={snapStep === step.value ? 'active' : ''}
              onClick={() => onSnapStepChange(step.value)}
            >
              {step.label}
            </button>
          ))}
        </div>
      </div>
      <label className="geometry-toggle">
        <input
          type="checkbox"
          checked={orthogonal}
          onChange={(event) => onOrthogonalChange(event.target.checked)}
        />
        <span>90°</span>
      </label>
    </div>
  );
}
