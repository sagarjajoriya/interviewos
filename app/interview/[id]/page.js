import InterviewRoom from "./InterviewRoom";

export const metadata = { title: "Interview · InterviewOS" };

export default async function InterviewPage({ params }) {
  const { id } = await params;
  return <InterviewRoom id={id} />;
}
