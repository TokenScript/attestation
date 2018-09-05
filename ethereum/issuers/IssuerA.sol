pragma solidity ^0.4.17;
import "../lib/Issuer";
import "../lib/AttestationFramework"; // to get BloomFilter

contract issuerA is Issuer {

    address issuer;
    mapping (address => string) attestationSigningKeysAndCapacity;
    mapping (address => uint) attestationKeyExpiry;

    constructor(address issuerForContract)
    {
        issuer = issuerForContract;
    }

    function verify(Attestation a)
    {
        /* THIS FUNCTION IS SUPPOSED TO BE CALLED FROM ANOTHER SMART CONTRACT, MOSTLY */
    	// 1. the attestation is not revoked // usually, check the bloom filter
    	// 2. the attestation is not expired
    	// 3. the attestation is signed by one of the current issuer's keys
      // 4. the sender is the attestation's owner
    	// 5. the issuer's key has not expired
      // 6. the merkle tree is well formed and the siganture on the tree is valid
    	require(attestationFramework.validateMerkle(ageAttestation));
    	// 7. any custom logic by the issuer (e.g. do not acknowledge
    	// any attestation issued before 2018-12-01 because they are
    	// all issued by a corrupt communist official
    }

    function addAttestorKey(address newAttestor, string capacity, uint expiry)
    {
       require(msg.sender == issuer);
	     // keep it in the states
       attestationSigningKeysAndCapacity[newAttestor] = capacity;
       attestationKeyExpiry[newAttestor] = expiry;
     }

    function replaceKey(address attestorToReplace, string capacity, uint expiry, address newAttestor)
    {
      require(msg.sender == issuer);
      delete attestationSigningKeysAndCapacity[attestorToReplace];
      delete attestationKeyExpiry[attestorToReplace];
      attestationSigningKeysAndCapacity[newAttestor] = capacity;
      attestationKeyExpiry[newAttestor] = expiry;
    }

    function removeKey(address attestor)
    {
      require(msg.sender == issuer);
      delete attestationSigningKeysAndCapacity[attestor];
      delete attestationKeyExpiry[attestor];
    }

    //this bloom filter merges with the old one
    //Issuer does this and constructs the bloom filter, only issuer can do this
    //in future, the issuer may want to delete the bloom filter
    function revokeAttestations(Bloomfilter b) {
  	//all bloom filters are stored in the contract variable space
    /* attestations are revoked in bulk by Bloomfilters. Notice
  	 * that this function is not required by the Issuer interface
  	 * - it is up to the issuer to decide if they use Bloomfilter
  	 * for revocation */
    }

}
