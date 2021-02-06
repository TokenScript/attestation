import { ATTESTATION_TYPE } from "./interfaces.js";
import { Point, CURVE_BN256 } from "./Point.js";
import { mod, uint8merge, stringToArray, BnPowMod, hexStringToArray, uint8tohex, bnToUint8, uint8ToBn } from "./utils.js";
import { ProofOfExponent } from "./ProofOfExponent.js";

import sha3pkg from "js-sha3";
const { keccak256 } = sha3pkg;

import getRandomValues_pkg from 'get-random-values';
const { getRandomValues } = getRandomValues_pkg;


// Generator for message part of Pedersen commitments generated deterministically from mapToInteger queried on 0 and mapped to the curve using try-and-increment
// export const Pedestren_G = new Point(20000156897076804373511442327333074562530252705735619022974068652767906975443n, 16135862203487767418272788596559070291202237796623574414172670126674549722701n, CURVE_BN256);
// Updated parameters #60
// export const Pedestren_G = new Point(12022136709705892117842496518378933837282529509560188557390124672992517127582n, 6765325636686621066142015726326349598074684595222800743368698766652936798612n, CURVE_BN256);
export const Pedestren_G = new Point(15729599519504045482191519010597390184315499143087863467258091083496429125073n, 1368880882406055711853124887741765079727455879193744504977106900552137574951n, CURVE_BN256);
// Generator for randomness part of Pedersen commitments generated deterministically from  mapToInteger queried on 1 to the curve using try-and-increment
// export const Pedestren_H = new Point(85797412565613170319266654805631801108755836445783043049717719714755607913068n, 55241105687255465486443020367129718693309139166156194387150856583227301086165n, CURVE_BN256);
// Updated parameters #60
// export const Pedestren_H = new Point(12263903704889727924109846582336855803381529831687633314439453294155493615168n, 1637819407897162978922461013726819811885734067940976901570219278871042378189n, CURVE_BN256);
export const Pedestren_H = new Point(10071451177251346351593122552258400731070307792115572537969044314339076126231n, 2894161621123416739138844080004799398680035544501805450971689609134516348045n, CURVE_BN256);
export class AttestationCrypto {
    constructor() {
        this.rand = this.makeSecret();
        // if (mod(CURVE_BN256.P,4n) != 3n) {
        //     throw new Error("The crypto will not work with this choice of curve");
        // }
        if (!this.verifyCurveOrder(CURVE_BN256.n)) {
            throw new Error("Static values do not work with current implementation");
        }
    }
    verifyCurveOrder(curveOrder) {
        // Verify that the curve order is less than 2^256 bits, which is required by mapToCurveMultiplier
        // Specifically checking if it is larger than 2^curveOrderBitLength and that no bits at position curveOrderBitLength+1 or larger are set
        let curveOrderBitLength = BigInt(curveOrder.toString(2).length);
        // console.log(`curve length = ${curveOrderBitLength}`);
        if (curveOrder < (1n << (curveOrderBitLength - 1n)) || (curveOrder >> curveOrderBitLength) > 0n) {
            console.log("Curve order is not 253 bits which is required by the current implementation");
            return false;
        }
        return true;
    }
    getType(type) {
        switch (type.toLowerCase()) {
            case "mail":
                return ATTESTATION_TYPE.mail;
            case "phone":
                return ATTESTATION_TYPE.phone;
            default:
                throw new Error("Wrong type of identifier");
        }
    }
    makeRiddle(identity, type, secret) {
        let hashedIdentity = this.hashIdentifier(type, identity);
        return hashedIdentity.multiplyDA(secret).getEncoded(false);
    }
    /**
     * Construct a Pedersen commitment to an identifier using a specific secret.
     * @param identity The common identifier
     * @param type The type of identifier
     * @param secret The secret randomness to be used in the commitment
     * @return
     */
    makeCommitment(identity, type, secret) {
        let hiding = Pedestren_H.multiplyDA(secret);
        return this.makeCommitmentFromHiding(identity, type, hiding);
    }
    /**
     * Constructs a commitment to an identity based on hidden randomization supplied from a user.
     * This is used to construct an attestation.
     * @param identity The user's identity.
     * @param type The type of identity.
     * @param hiding The hiding the user has picked
     * @return
     */
    makeCommitmentFromHiding(identity, type, hiding) {
        // let hashedIdentity:bigint = this.mapToIntegerIntString(type, identity);
        let hashedIdentity = this.mapToCurveMultiplier(type, identity);
        // Construct Pedersen commitment
        let commitment = Pedestren_G.multiplyDA(hashedIdentity).add(hiding);
        return commitment.getEncoded(false);
    }
    // TODO use type
    hashIdentifier(type, identity) {
        let idenNum = this.mapToInteger(type, Uint8Array.from(stringToArray(identity.trim().toLowerCase())));
        // console.log(`idenNum(for base point) = ${idenNum}`);
        return this.computePoint_bn256(idenNum);
    }
    injectIdentifierType(type, arr) {
        // add prefix [0,0,0,1] for email type
        return uint8merge([Uint8Array.from([0, 0, 0, type]), arr]);
    }
    mapToInteger(type, arr) {
        return this.mapToIntegerFromUint8(this.injectIdentifierType(type, arr));
    }
    mapToIntegerIntString(type, str) {
        return this.mapToInteger(type, Uint8Array.from(stringToArray(str)));
    }
    mapToCurveMultiplier(type, identity) {
        let identityBytes = Uint8Array.from(stringToArray(identity.trim().toLowerCase()));
        let uintArr = this.injectIdentifierType(type, identityBytes);
        let sampledVal = uint8ToBn(uintArr);
        do {
            sampledVal = this.mapTo256BitInteger(bnToUint8(sampledVal));
        } while (sampledVal >= CURVE_BN256.n);
        return sampledVal;
    }
    /**
     * Map a byte array into a uniformly random 256 bit (positive) integer, stored as a Big Integer.
     */
    mapTo256BitInteger(input) {
        return BigInt('0x' + keccak256(input));
    }
    mapToIntegerFromUint8(arr) {
        // let idenNum = BigInt( '0x'+ keccak384(arr));
        // return mod(idenNum, CURVE_BN256.P);
        let hash0 = keccak256(uint8merge([Uint8Array.from([0]), arr]));
        let hash1 = keccak256(uint8merge([Uint8Array.from([1]), arr]));
        return BigInt('0x' + hash0 + hash1);
    }
    // computePoint_SECP256k1( x: bigint ): Point {
    //     x = mod ( x );
    //     let y = 0n, expected = 0n, ySquare = 0n;
    //     let resPoint,referencePoint: Point;
    //     let p = CURVE_SECP256k1.P;
    //     let a = CURVE_SECP256k1.A;
    //     let b = CURVE_SECP256k1.B;
    //     do {
    //         do {
    //             x = mod(x + 1n);
    //             ySquare = mod(BnPowMod(x, 3n, p) + a * x + b);
    //             y = BnPowMod(ySquare, CURVE_SECP256k1.magicExp, p);
    //             expected = mod(y * y);
    //         } while (expected !== ySquare);
    //         resPoint = new Point(x, y);
    //         // TODO add Point.negate() and use following logic
    //         // Ensure that we have a consistent choice of which "sign" of y we use. We always use the smallest possible value of y
    //         if (resPoint.y > (p / 2n)) {
    //             resPoint = new Point(x, p - y);
    //         }
    //         referencePoint = resPoint.multiplyDA(CURVE_SECP256k1.n - 1n);
    //         if (referencePoint.y > (p / 2n)) {
    //             referencePoint = new Point(referencePoint.x, p - referencePoint.y);
    //         }
    //     } while (!resPoint.equals(referencePoint))
    //     return resPoint;
    // }
    computePoint_bn256(x) {
        let fieldSize = CURVE_BN256.P;
        x = mod(x, fieldSize);
        let y = 0n, ySquare = 0n;
        let resPoint, referencePoint;
        let quadraticResidue;
        let magicExp = (fieldSize + 1n) >> 2n; // fieldSize + 1 / 4
        let quadraticResidueExp = (fieldSize - 1n) >> 1n;
        do {
            do {
                x = mod(x + 1n);
                // console.log('x = ' + x );
                ySquare = mod(BnPowMod(x, 3n, fieldSize) + CURVE_BN256.A * x + CURVE_BN256.B);
                quadraticResidue = BnPowMod(ySquare, quadraticResidueExp, fieldSize);
            } while (quadraticResidue !== 1n);
            // We use the Lagrange trick to compute the squareroot (since fieldSize mod 4=3)
            y = BnPowMod(ySquare, magicExp, fieldSize);
            resPoint = new Point(x, y, CURVE_BN256);
            // Ensure that we have a consistent choice of which "sign" of y we use. We always use the smallest possible value of y
            if (resPoint.x > (fieldSize >> 1n)) {
                resPoint = new Point(x, fieldSize - y, CURVE_BN256);
            }
            referencePoint = resPoint.multiplyDA(CURVE_BN256.n - 1n);
            if (referencePoint.y > (fieldSize >> 1n)) {
                referencePoint = new Point(referencePoint.x, fieldSize - referencePoint.y, CURVE_BN256);
            }
            // Verify that the element is a member of the expected (subgroup) by ensuring that it has the right order, through Fermat's little theorem
            // NOTE: this is ONLY needed if we DON'T use secp256k1, so currently it is superflous but we are keeping it this check is crucial for security on most other curves!
        } while (!resPoint.equals(referencePoint) || resPoint.isInfinity());
        return resPoint;
    }
    makeSecret(bytes = 48) {
        var array = new Uint8Array(bytes);
        if(typeof(window) !== 'undefined')
            window.crypto.getRandomValues(array);
        else
            getRandomValues(array);
        let output = '0x';
        for (var i = 0; i < array.length; i++) {
            output += array[i].toString(16);
        }
        return mod(BigInt(output), CURVE_BN256.n);
    }
    constructProof(identity, type, secret) {
        const hashedIdentity = this.hashIdentifier(type, identity);
        const identifier = hashedIdentity.multiplyDA(secret);
        return this.computeProof(hashedIdentity, identifier, secret);
    }
    /**
     * Computes a proof of knowledge of a random exponent
     * This is used to convince the attestor that the user knows a secret which the attestor will
     * then use to construct a Pedersen commitment to the user's identifier.
     * @param randomness The randomness used in the commitment
     * @return
     */
    // public computeAttestationProof(randomness: bigint): ProofOfExponent {
    // // Compute the random part of the commitment, i.e. H^randomness
    //     let riddle: Point = Pedestren_H.multiplyDA(randomness);
    //     let r: bigint = this.makeSecret();
    //     let t:Point = Pedestren_H.multiplyDA(r);
    //     let c:bigint = mod(this.mapToIntegerFromUint8(this.makeArray([Pedestren_G, Pedestren_H, riddle, t])) , CURVE_BN256.n);
    //     let d:bigint = mod(r + c * randomness, CURVE_BN256.n);
    //     return new ProofOfExponent(Pedestren_H, riddle, t, d);
    // }
    computeAttestationProof(randomness) {
        // Compute the random part of the commitment, i.e. H^randomness
        let riddle = Pedestren_H.multiplyDA(randomness);
        let challengeList = [Pedestren_G, Pedestren_H, riddle];
        return this.constructSchnorrPOK(riddle, randomness, challengeList);
    }
    /**
     * Compute a proof that commitment1 and commitment2 are Pedersen commitments to the same message and that the user
     * knows randomness1-randomness2.
     * NOTE: We are actually not proving that the user knows the message and randomness1 and randomness2.
     * This is because we assume the user has already proven knowledge of his message (mail) and the
     * randomness1 used in the attestation to the attestor. Because of this assumption it is enough to prove
     * knowledge of randomness2 (equivalent to proving knowledge of randomness1-randomness2) and that the
     * commitments are to the same message.
     * The reason we do this is that this weaker proof is significantly cheaper to execute on the blockchain.
     *
     * In conclusion what this method actually proves is knowledge that randomness1-randomness2 is the
     * discrete log of commitment1/commitment2.
     * I.e. that commitment1/commitment2 =H^(randomness1-randomness2)
     * @param commitment1 First Pedersen commitment to some message m
     * @param commitment2 Second Pedersen commitment to some message m
     * @param randomness1 The randomness used in commitment1
     * @param randomness2 The randomness used in commitment2
     * @return
     */
    computeEqualityProof(commitment1, commitment2, randomness1, randomness2) {
        let comPoint1 = Point.decodeFromHex(commitment1, CURVE_BN256);
        let comPoint2 = Point.decodeFromHex(commitment2, CURVE_BN256);
        // Compute H*(randomness1-randomness2=commitment1-commitment2=G*msg+H*randomness1-G*msg+H*randomness2
        let riddle = comPoint1.subtract(comPoint2);
        let exponent = mod(randomness1 - randomness2, CURVE_BN256.n);
        let challengeList = [Pedestren_G, Pedestren_H, comPoint1, comPoint2];
        return this.constructSchnorrPOK(riddle, exponent, challengeList);
    }
    /**
     * Constructs a Schnorr proof of knowledge of exponent of a riddle to base H.
     * The challenge value used (c) is computed from the challengeList and the internal t value.
     * The method uses rejection sampling to ensure that the t value is sampled s.t. the
     * challenge will always be less than curveOrder.
     */
    constructSchnorrPOK(riddle, exponent, challengeList) {
        let t;
        let c, d;
        // Use rejection sampling to sample a hiding value s.t. the random oracle challenge c computed from it is less than curveOrder
        do {
            let hiding = this.makeSecret();
            t = Pedestren_H.multiplyDA(hiding);
            challengeList.push(t);
            c = mod(this.mapTo256BitInteger(this.makeArray(challengeList)), CURVE_BN256.n);
            d = mod(hiding + c * exponent, CURVE_BN256.n);
        } while (c >= CURVE_BN256.n);
        return new ProofOfExponent(Pedestren_H, riddle, t, d);
    }
    /**
     * Verifies a zero knowledge proof of knowledge of a riddle used in an attestation request
     * @param pok The proof to verify
     * @return True if the proof is OK and false otherwise
     */
    verifyAttestationRequestProof(pok) {
        // let c:bigint = mod(this.mapToIntegerFromUint8(this.makeArray([Pedestren_G, pok.getBase(), pok.getRiddle(), pok.getPoint()])),CURVE_BN256.n);
        let c = mod(this.mapTo256BitInteger(this.makeArray([Pedestren_G, pok.getBase(), pok.getRiddle(), pok.getPoint()])), CURVE_BN256.n);
        // Ensure that the right base has been used in the proof
        if (!pok.getBase().equals(Pedestren_H)) {
            return false;
        }
        return this.verifyPok(pok, c);
    }
    /**
     * Verifies a zero knowledge proof of knowledge of the two riddles used in two different
     * commitments to the same message.
     * This is used by the smart contract to verify that a request is ok where one commitment is the
     * riddle for a cheque/ticket and the other is the riddle from an attesation.
     * @param pok The proof to verify
     * @return True if the proof is OK and false otherwise
     */
    verifyEqualityProof(commitment1, commitment2, pok) {
        let comPoint1 = Point.decodeFromHex(uint8tohex(commitment1), CURVE_BN256);
        let comPoint2 = Point.decodeFromHex(uint8tohex(commitment2), CURVE_BN256);
        // Compute the value the riddle should have
        let riddle = comPoint1.subtract(comPoint2);
        // Verify the proof matches the commitments
        if (!riddle.equals(pok.getRiddle())) {
            return false;
        }
        // Ensure that the right base has been used in the proof
        if (!pok.getBase().equals(Pedestren_H)) {
            return false;
        }
        // let c = this.mapToIntegerFromUint8(this.makeArray([Pedestren_G, Pedestren_H, comPoint1, comPoint2, pok.getPoint()]));
        let c = this.mapTo256BitInteger(this.makeArray([Pedestren_G, pok.getBase(), comPoint1, comPoint2, pok.getPoint()]));
        return this.verifyPok(pok, c);
    }
    verifyPok(pok, c) {
        let lhs = pok.getBase().multiplyDA(pok.getChallenge());
        let rhs = pok.getRiddle().multiplyDA(c).add(pok.getPoint());
        return lhs.equals(rhs);
    }
    computeProof(base, riddle, exponent) {
        let r = this.makeSecret();
        let t = base.multiplyDA(r);
        // TODO ideally Bob's ethreum address should also be part of the challenge
        let c = mod(this.mapToIntegerFromUint8(this.makeArray([base, riddle, t])), CURVE_BN256.n);
        let d = mod(r + c * exponent, CURVE_BN256.n);
        return new ProofOfExponent(base, riddle, t, d);
    }
    makeArray(pointArray) {
        let output = new Uint8Array(0);
        pointArray.forEach((item) => {
            // console.log('Point.getEncoded');
            // console.log(item.getEncoded(false));
            output = new Uint8Array([...output, ...item.getEncoded(false)]);
        });
        return output;
    }
    verifyProof(pok) {
        let c = mod(this.mapToIntegerFromUint8(this.makeArray([pok.getBase(), pok.getRiddle(), pok.getPoint()])), CURVE_BN256.n);
        // console.log(`pok.getChallenge = ( ${pok.getChallenge()} )`);
        // console.log(`c = ( ${c} )`);
        let lhs = pok.getBase().multiplyDA(pok.getChallenge());
        let rhs = pok.getRiddle().multiplyDA(c).add(pok.getPoint());
        // console.log(`Point lhs = ( ${lhs.x} , ${lhs.y})`);
        // console.log(`Point rhs = ( ${rhs.x} , ${rhs.y})`);
        return lhs.equals(rhs);
    }
    addressFromKey(key) {
        let pubKey = key.getPublicKeyAsHexStr();
        let pubKeyHash = keccak256(hexStringToArray(pubKey));
        return '0x' + pubKeyHash.slice(-40).toUpperCase();
    }
}
AttestationCrypto.OID_SIGNATURE_ALG = "1.2.840.10045.2.1";