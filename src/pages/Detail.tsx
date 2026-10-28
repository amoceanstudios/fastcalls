import { useParams, Link, useLocation } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft } from "lucide-react";
import { db } from "../db/database";
import ProspectWorkspace from "../components/ProspectWorkspace";
export default function Detail() {
  const { id } = useParams();
  const location = useLocation();
  const requestedReturn = location.state?.workReturn;
  const back =
    typeof requestedReturn === "string" &&
    (requestedReturn === "/" || requestedReturn.startsWith("/work"))
      ? requestedReturn
      : "/prospects";
  const data = useLiveQuery(
    async () => ({ p: await db.prospects.get(id ?? "") }),
    [id],
  );
  return (
    <>
      <Link className="back-link" to={back}>
        <ArrowLeft size={16} />
        {back.startsWith("/work")
          ? "Terug naar Mijn werk"
          : back === "/"
            ? "Terug naar overzicht"
            : "Alle bedrijven"}
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
