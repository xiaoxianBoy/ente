import { ensure } from "@/utils/ensure";
import { HOTP, TOTP } from "otpauth";
import { Steam } from "./steam";

/**
 * A parsed representation of an *OTP code URI.
 *
 * This is all the data we need to drive a OTP generator.
 */
export interface Code {
    /** A unique id for the corresponding "auth entity" in our system. */
    id?: String;
    /** The type of the code. */
    type: "totp" | "hotp" | "steam";
    /** The user's account or email for which this code is used. */
    account?: string;
    /** The name of the entity that issued this code. */
    issuer: string;
    /**
     * Length of the generated OTP.
     *
     * This is vernacularly called "digits", which is an accurate description
     * for the OG TOTP/HOTP codes. However, steam codes are not just digits, so
     * we name this as a content-neutral "length".
     */
    length: number;
    /**
     * The time period (in seconds) for which a single OTP generated from this
     * code remains valid.
     */
    period: number;
    /** The (HMAC) algorithm used by the OTP generator. */
    algorithm: "sha1" | "sha256" | "sha512";
    /**
     * HOTP counter.
     *
     * Only valid for HOTP codes. It might be even missing for HOTP codes, in
     * which case we should start from 0.
     */
    counter?: number;
    /**
     * The secret that is used to drive the OTP generator.
     *
     * This is an arbitrary key encoded in Base32 that drives the HMAC (in a
     * {@link type}-specific manner).
     */
    secret: string;
    /** The original string from which this code was generated. */
    uriString: string;
}

/**
 * Convert a OTP code URI into its parse representation, a {@link Code}.
 *
 * @param id A unique ID of this code within the auth app.
 *
 * @param uriString A string specifying how to generate a TOTP/HOTP/Steam OTP
 * code. These strings are of the form:
 *
 * - (TOTP)
 *   otpauth://totp/ACME:user@example.org?algorithm=SHA1&digits=6&issuer=acme&period=30&secret=ALPHANUM
 *
 * - (HOTP)
 *   otpauth://hotp/Test?secret=AAABBBCCCDDDEEEFFF&issuer=Test&counter=0
 *
 * - (Steam)
 *   otpauth://steam/Steam:SteamAccount?algorithm=SHA1&digits=5&issuer=Steam&period=30&secret=AAABBBCCCDDDEEEFFF
 *
 * See also `auth/test/models/code_test.dart`.
 */
export const codeFromURIString = (id: string, uriString: string): Code => {
    try {
        return _codeFromURIString(id, uriString);
    } catch (e) {
        // We might have legacy encodings of account names that contain a "#",
        // which causes the rest of the URL to be treated as a fragment, and
        // ignored. See if this was potentially such a case, otherwise rethrow.
        if (uriString.includes("#"))
            return _codeFromURIString(id, uriString.replaceAll("#", "%23"));
        throw e;
    }
};

const _codeFromURIString = (id: string, uriString: string): Code => {
    const url = new URL(uriString);

    // A URL like
    //
    // new URL("otpauth://hotp/Test?secret=AAABBBCCCDDDEEEFFF&issuer=Test&counter=0")
    //
    // is parsed differently by the browser and Node depending on the scheme.
    // When the scheme is http(s), then both of them consider "hotp" as the
    // `host`. However, when the scheme is "otpauth", as is our case, the
    // browser considers the entire thing as part of the pathname. so we get.
    //
    //     host: ""
    //     pathname: "//hotp/Test"
    //
    // Since this code run on browsers only, we parse as per that behaviour.

    const [type, path] = parsePathname(url);

    return {
        id,
        type,
        account: parseAccount(path),
        issuer: parseIssuer(url, path),
        length: parseLength(url, type),
        period: parsePeriod(url),
        algorithm: parseAlgorithm(url),
        counter: parseCounter(url),
        secret: parseSecret(url),
        uriString,
    };
};

const parsePathname = (url: URL): [type: Code["type"], path: string] => {
    const p = url.pathname.toLowerCase();
    if (p.startsWith("//totp")) return ["totp", url.pathname.slice(6)];
    if (p.startsWith("//hotp")) return ["hotp", url.pathname.slice(6)];
    if (p.startsWith("//steam")) return ["steam", url.pathname.slice(7)];
    throw new Error(`Unsupported code or unparseable path "${url.pathname}"`);
};

const parseAccount = (path: string): string | undefined => {
    // "/ACME:user@example.org" => "user@example.org"
    let p = decodeURIComponent(path);
    if (p.startsWith("/")) p = p.slice(1);
    if (p.includes(":")) p = p.split(":").slice(1).join(":");
    return p;
};

const parseIssuer = (url: URL, path: string): string => {
    // If there is a "issuer" search param, use that.
    let issuer = url.searchParams.get("issuer");
    if (issuer) {
        // This is to handle bug in old versions of Ente Auth app.
        if (issuer.endsWith("period")) {
            issuer = issuer.substring(0, issuer.length - 6);
        }
        return issuer;
    }

    // Otherwise use the `prefix:` from the account as the issuer.
    // "/ACME:user@example.org" => "ACME"
    let p = decodeURIComponent(path);
    if (p.startsWith("/")) p = p.slice(1);

    if (p.includes(":")) p = p.split(":")[0];
    else if (p.includes("-")) p = p.split("-")[0];

    return p;
};

/**
 * Parse the length of the generated code.
 *
 * The URI query param is called digits since originally TOTP/HOTP codes used
 * this for generating numeric codes. Now we also support steam, which instead
 * shows non-numeric codes, and also with a different default length of 5.
 */
const parseLength = (url: URL, type: Code["type"]): number => {
    const defaultLength = type == "steam" ? 5 : 6;
    return parseInt(url.searchParams.get("digits") ?? "", 10) || defaultLength;
};

const parsePeriod = (url: URL): number =>
    parseInt(url.searchParams.get("period") ?? "", 10) || 30;

const parseAlgorithm = (url: URL): Code["algorithm"] => {
    switch (url.searchParams.get("algorithm")?.toLowerCase()) {
        case "sha256":
            return "sha256";
        case "sha512":
            return "sha512";
        default:
            return "sha1";
    }
};

const parseCounter = (url: URL): number | undefined => {
    const c = url.searchParams.get("counter");
    return c ? parseInt(c, 10) : undefined;
};

const parseSecret = (url: URL): string =>
    ensure(url.searchParams.get("secret")).replaceAll(" ", "").toUpperCase();

/**
 * Generate a pair of OTPs (one time passwords) from the given {@link code}.
 *
 * @param code The parsed code data, including the secret and code type.
 *
 * @returns a pair of OTPs, the current one and the next one, using the given
 * {@link code}.
 */
export const generateOTPs = (code: Code): [otp: string, nextOTP: string] => {
    let otp: string;
    let nextOTP: string;
    switch (code.type) {
        case "totp": {
            const totp = new TOTP({
                secret: code.secret,
                algorithm: code.algorithm,
                period: code.period,
                digits: code.length,
            });
            otp = totp.generate();
            nextOTP = totp.generate({
                timestamp: Date.now() + code.period * 1000,
            });
            break;
        }

        case "hotp": {
            const counter = code.counter || 0;
            const hotp = new HOTP({
                secret: code.secret,
                counter: counter,
                algorithm: code.algorithm,
            });
            otp = hotp.generate({ counter });
            nextOTP = hotp.generate({ counter: counter + 1 });
            break;
        }

        case "steam": {
            const steam = new Steam({
                secret: code.secret,
            });
            otp = steam.generate();
            nextOTP = steam.generate({
                timestamp: Date.now() + code.period * 1000,
            });
            break;
        }
    }
    return [otp, nextOTP];
};
