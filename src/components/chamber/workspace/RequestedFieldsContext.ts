// The fields an advisor's open request for information is about, for the field rows in the workspace tabs: each
// says the advisor asked about it. The Chamber page reads the request (useInformationRequest); a context hands the
// fields to every ProvenanceField without threading a prop through each tab. Empty by default.
import { createContext, useContext } from "react";
import { NO_REQUESTED_FIELDS } from "@/data/informationRequest";

export const RequestedFieldsContext = createContext<ReadonlySet<string>>(NO_REQUESTED_FIELDS);

export const useRequestedFields = () => useContext(RequestedFieldsContext);
