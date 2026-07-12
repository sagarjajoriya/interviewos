import ReportView from "./ReportView";

export const metadata = { title: "Report · InterviewOS" };

export default async function ReportPage({ params }) {
  const { id } = await params;
  return <ReportView id={id} />;
}
