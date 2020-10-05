package dk.alexandra.stormbird.issuer;

import static dk.alexandra.stormbird.issuer.Attestation.CURVE_PARAM;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.security.Security;
import java.util.Date;
import java.util.List;
import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.asn1.x509.SubjectPublicKeyInfo;
import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.cert.jcajce.JcaX509ContentVerifierProviderBuilder;
import org.bouncycastle.crypto.AsymmetricCipherKeyPair;
import org.bouncycastle.crypto.generators.ECKeyPairGenerator;
import org.bouncycastle.crypto.params.ECDomainParameters;
import org.bouncycastle.crypto.params.ECKeyGenerationParameters;
import org.bouncycastle.crypto.util.SubjectPublicKeyInfoFactory;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.operator.ContentVerifierProvider;
import org.json.JSONObject;
import org.junit.Assert;
import org.junit.Test;

public class TestAttestation {
  public static final String ISSUER_ENCODED_PK = "-----BEGIN PUBLIC KEY-----\n"
      + "MIIBMzCB7AYHKoZIzj0CATCB4AIBATAsBgcqhkjOPQEBAiEA/////////////////\n"
      + "////////////////////v///C8wRAQgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\n"
      + "AAAAAAAAAEIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHBEEEeb5mfvn\n"
      + "cu6xVoGKVzocLBwKb/NstzijZWfKBWxb4F5hIOtp3JqPEZV2k+/wOEQio/Re0SKaF\n"
      + "VBmcR9CP+xDUuAIhAP////////////////////66rtzmr0igO7/SXozQNkFBAgEBA\n"
      + "0IABJUMfAvtI8PKxcwxu7mq2btVMjh4gmcKwrHN8HmasOvHZMJn9wTo/doHlquDl6\n"
      + "TSEBAk0kxO//aVs6QX8u0OSM0=\n"
      + "-----END PUBLIC KEY-----";
  public static final String ISSUER_ENCODED_SK = "-----BEGIN PRIVATE KEY-----\n"
      + "MIICSwIBADCB7AYHKoZIzj0CATCB4AIBATAsBgcqhkjOPQEBAiEA/////////////\n"
      + "////////////////////////v///C8wRAQgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\n"
      + "AAAAAAAAAAAAAEIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHBEEEeb5\n"
      + "mfvncu6xVoGKVzocLBwKb/NstzijZWfKBWxb4F5hIOtp3JqPEZV2k+/wOEQio/Re0\n"
      + "SKaFVBmcR9CP+xDUuAIhAP////////////////////66rtzmr0igO7/SXozQNkFBA\n"
      + "gEBBIIBVTCCAVECAQEEIDwZ/11FPHiR7bkv5wZi1eRa72WOnzjfmwSD9q4tjeZuoI\n"
      + "HjMIHgAgEBMCwGByqGSM49AQECIQD////////////////////////////////////\n"
      + "+///8LzBEBCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQgAAAAAAAA\n"
      + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcEQQR5vmZ++dy7rFWgYpXOhwsHApv82\n"
      + "y3OKNlZ8oFbFvgXmEg62ncmo8RlXaT7/A4RCKj9F7RIpoVUGZxH0I/7ENS4AiEA//\n"
      + "///////////////////rqu3OavSKA7v9JejNA2QUECAQGhRANCAASVDHwL7SPDysX\n"
      + "MMbu5qtm7VTI4eIJnCsKxzfB5mrDrx2TCZ/cE6P3aB5arg5ek0hAQJNJMTv/2lbOk\n"
      + "F/LtDkjN\n"
      + "-----END PRIVATE KEY-----";
  public static final ECDomainParameters DOMAIN = new ECDomainParameters(CURVE_PARAM.getCurve(), CURVE_PARAM.getG(), CURVE_PARAM.getN(), CURVE_PARAM.getH());
  private static AsymmetricCipherKeyPair serverKeys, userKeys;
  private static String request;
  private static JSONObject record; // "Record" from the verifyResponse.json
  private static SecureRandom rand;
  private static Attestation att;

  @org.junit.BeforeClass
  public static void setupAttestation() throws Exception {
    rand = SecureRandom.getInstance("SHA1PRNG");
    rand.setSeed("seed".getBytes());
    long lifetime = 31536000000l; // one year
    serverKeys = new AsymmetricCipherKeyPair(ASN1Util.restoreBase64PublicKey(ISSUER_ENCODED_PK),
        ASN1Util.restoreBase64PrivateKey(ISSUER_ENCODED_SK));
    att = new Attestation(serverKeys, new X500Name("CN=Stormbird"), lifetime);
    JSONObject response = new JSONObject(Files.readString(Path.of("tests/verification_response.json")));
    record = response.getJSONObject("Record");
  }

  @Test
  public void testSunshine() throws Exception {
    /* setting up user's key, to sign verifyRequest */
    userKeys = constructSecp256k1Keys(rand);
    SubjectPublicKeyInfo spki = SubjectPublicKeyInfoFactory.createSubjectPublicKeyInfo(userKeys.getPublic());
    byte[] userPK = spki.getPublicKeyData().getEncoded();
    //System.out.println(ASN1Util.printDER(userPK, "PUBLIC KEY"));

    /* signing verifyRequest */
    request = Files.readString(Path.of("tests/verification_request.json"));
    Security.addProvider(new BouncyCastleProvider());
    byte[] requestJson = request.getBytes(StandardCharsets.UTF_8);
    byte[] signature = SignatureUtil.signKeccak(requestJson, userKeys.getPrivate());

    /* obtaining resulting attestations */
    List<byte[]> derEncodedAttestations = att.constructAttestation(request, record.toString(), signature, userPK);
    JcaX509ContentVerifierProviderBuilder builder = new JcaX509ContentVerifierProviderBuilder();
    SubjectPublicKeyInfo issuerSpki =  SubjectPublicKeyInfoFactory.createSubjectPublicKeyInfo(serverKeys.getPublic());
    ContentVerifierProvider verifier = builder.build(issuerSpki);
    for (byte[] current : derEncodedAttestations) {
      System.out.println(ASN1Util.printDER(current, "CERTIFICATE"));
      X509CertificateHolder currentCert = new X509CertificateHolder(current);
      Assert.assertTrue(currentCert.isValidOn(new Date(System.currentTimeMillis())));
      Assert.assertTrue(currentCert.isSignatureValid(verifier));
    }

    // TODO the code below does not work since only named ECParameters are supported in X509CertImpl
//    for (byte[] current : certs) {
//      X509Certificate cert = new X509CertImpl(current);
//      try {
//        cert.verify(serverPK, new BouncyCastleProvider());
//        cert.checkValidity();
//      } catch (CertificateExpiredException | CertificateNotYetValidException e) {
//        Assert.fail();
//      }
//    }

  }

  public static AsymmetricCipherKeyPair constructSecp256k1Keys(SecureRandom rand) {
    ECKeyPairGenerator generator = new ECKeyPairGenerator();
    ECKeyGenerationParameters keygenParams = new ECKeyGenerationParameters(DOMAIN, rand);
    generator.init(keygenParams);
    return generator.generateKeyPair();
  }
}