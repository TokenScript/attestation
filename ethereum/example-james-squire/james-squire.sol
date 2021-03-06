/* A demonstration of how to use attestation in validating customers'
 * purchase. The contract assumes the scenario of alcohol purchase
 * from a vendor James Squire. The contract will be satisfied if the
 * buyer can prove that his residential country is Australia and the
 * buyer's age is above 18. It, however, allows the contract's owner
 * to extend to allow consumers from other countries, and in the case
 * the said country doesn't have an age restriction on drinking, for
 * example China, the contract should only require a proof of
 * residency in China.*/

import "../lib/AttestationFramework";
import "../lib/Authorisedattesters";

contract james-squire is AttestationFramework, Authorisedattesters
{

    AttestationFramework attestationFramework;
    Authorisedattesters authorisedattesters;
    string[] ageExemptCountries;

    constructor(
      address attestationFrameworkAddress,
      address authorisedattestersAddress,
      string[] ageExemptAndAcceptedCountries
    )
    {
        attestationFramework = new AttestationFramework(attestationFrameworkAddress);
        authorisedattesters = new Authorisedattesters(authorisedattestersAddress);
        ageExemptCountries = ageExemptAndAcceptedCountries;
    }

    //TODO range proof
    function canPurchaseAlcohol(Attestation ageAttestation) public returns (bool)
    {
        require(attestationFramework.validateMerkle(ageAttestation));
        bool isExempt = isAgeExemptAndAcceptedCountry(ageAttestation.value);
        if(isExempt) return true;
        //TODO probably need multiple branches?
        //if(ageAttestation.age >= 18) return true;
        return false;
    }

    function isAgeExemptAndAcceptedCountry(string country) public returns (bool)
    {
        for(uint i = 0; i < ageExemptAndAcceptedCountries.length; i++)
        {
            if(country == ageExemptAndAcceptedCountries[i]) return true;
        }
        return false;
    }
}
