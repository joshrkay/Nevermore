// Which fields an advisor has verified, for the field rows in the workspace tabs (B-2.1). The Chamber page loads
// the set (session_verified_fields, read whenever a row is loaded); a context hands it to every ProvenanceField without threading a prop
// through each tab. Empty by default, so a row outside the workspace (the demo, a test) shows nothing extra.
import { createContext, useContext } from "react";
import { NO_VERIFIED_FIELDS } from "@/data/requiredItems";

export const VerifiedFieldsContext = createContext<ReadonlySet<string>>(NO_VERIFIED_FIELDS);

export const useVerifiedFields = () => useContext(VerifiedFieldsContext);
