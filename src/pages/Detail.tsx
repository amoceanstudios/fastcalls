import { useParams, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft } from "lucide-react";
import { db } from "../db/database";
import ProspectWorkspace from "../components/ProspectWorkspace";
export default function Detail() {
  const { id } = useParams();
  const data = useLiveQuery(
    async () => ({ p: await db.prospects.get(id ?? "") }),
    [id],
  );
  return (
    <>
      <Link className="back-link" to="/prospects">
        <ArrowLeft size={16} />
        Alle prospects
      </Link>
      {!data ? (
        <p>Laden…</p>
      ) : data.p ? (
        <ProspectWorkspace key={data.p.id} p={data.p} />
      ) : (
        <p>Dit bedrijf bestaat niet (meer). Ga terug naar het overzicht.</p>
      )}
    </>
  );
}
