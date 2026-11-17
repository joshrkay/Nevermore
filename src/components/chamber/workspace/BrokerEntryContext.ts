// Whether the chamber on screen is a member of the firm working an intake the firm started, as the broker, not its employer (D-1751). The workspace provides it; a context hands it to every
// ProvenanceField without threading a prop through each tab. False by default, so a field outside a broker's chamber (the employer's, the demo, a test) is as it always was.
import { createContext, useContext } from "react";

export const BrokerEntryContext = createContext(false);

export const useBrokerEntry = () => useContext(BrokerEntryContext);
