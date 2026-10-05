import {
  Hero, BuiltOn, Problem, WhoFor, HowItWorks, UseCases, VerifierLearns, Operator, Evidence, TryIt,
  Measured, Safeguards, Compare, Status, Roadmap, FAQ, Team, ClosingCta,
} from "@/components/tally/sections";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Hero />
      <BuiltOn />
      <Problem />
      <WhoFor />
      <HowItWorks />
      <UseCases />
      <VerifierLearns />
      <Operator />
      <Evidence />
      <TryIt />
      <Measured />
      <Safeguards />
      <Compare />
      <Status />
      <Roadmap />
      <FAQ />
      <Team />
      <ClosingCta />
    </div>
  );
}
