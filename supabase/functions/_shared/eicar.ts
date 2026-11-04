// The EICAR anti-malware test file, for tests and the runbook's scanner check only: every scanner reports it
// (clamd as "Eicar-Signature" or "Win.Test.EICAR_HDB-1"), and it is harmless. Assembled from parts so this
// source file is not itself flagged by a scanner on a developer's machine. Nothing deployed imports it.
export const EICAR = ["X5O!P%@AP[4\\PZX54(P^)7CC)7}$", "EICAR-STANDARD-ANTIVIRUS-TEST-FILE!", "$H+H*"].join("");
