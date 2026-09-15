import ToolRail from './ToolRail';

export default function PlannerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToolRail />
    </>
  );
}
