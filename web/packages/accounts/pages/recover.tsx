import log from "@/next/log";
import { sendOtt } from "@ente/accounts/api/user";
import { PAGES } from "@ente/accounts/constants/pages";
import { APP_HOMES } from "@ente/shared/apps/constants";
import type { PageProps } from "@ente/shared/apps/types";
import { VerticallyCentered } from "@ente/shared/components/Container";
import FormPaper from "@ente/shared/components/Form/FormPaper";
import FormPaperFooter from "@ente/shared/components/Form/FormPaper/Footer";
import FormPaperTitle from "@ente/shared/components/Form/FormPaper/Title";
import LinkButton from "@ente/shared/components/LinkButton";
import SingleInputForm, {
    type SingleInputFormProps,
} from "@ente/shared/components/SingleInputForm";
import ComlinkCryptoWorker from "@ente/shared/crypto";
import {
    decryptAndStoreToken,
    saveKeyInSessionStore,
} from "@ente/shared/crypto/helpers";
import InMemoryStore, { MS_KEYS } from "@ente/shared/storage/InMemoryStore";
import { LS_KEYS, getData, setData } from "@ente/shared/storage/localStorage";
import { SESSION_KEYS, getKey } from "@ente/shared/storage/sessionStorage";
import type { KeyAttributes, User } from "@ente/shared/user/types";
import { t } from "i18next";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const bip39 = require("bip39");
// mobile client library only supports english.
bip39.setDefaultWordlist("english");

export default function Recover({ appContext, appName }: PageProps) {
    const [keyAttributes, setKeyAttributes] = useState<KeyAttributes>();

    const router = useRouter();

    useEffect(() => {
        const user: User = getData(LS_KEYS.USER);
        const keyAttributes: KeyAttributes = getData(LS_KEYS.KEY_ATTRIBUTES);
        const key = getKey(SESSION_KEYS.ENCRYPTION_KEY);
        if (!user?.email) {
            router.push(PAGES.ROOT);
            return;
        }
        if (!user?.encryptedToken && !user?.token) {
            sendOtt(appName, user.email);
            InMemoryStore.set(MS_KEYS.REDIRECT_URL, PAGES.RECOVER);
            router.push(PAGES.VERIFY);
            return;
        }
        if (!keyAttributes) {
            router.push(PAGES.GENERATE);
        } else if (key) {
            router.push(APP_HOMES.get(appName));
        } else {
            setKeyAttributes(keyAttributes);
        }
        appContext.showNavBar(true);
    }, []);

    const recover: SingleInputFormProps["callback"] = async (
        recoveryKey: string,
        setFieldError,
    ) => {
        try {
            recoveryKey = recoveryKey
                .trim()
                .split(" ")
                .map((part) => part.trim())
                .filter((part) => !!part)
                .join(" ");
            // check if user is entering mnemonic recovery key
            if (recoveryKey.indexOf(" ") > 0) {
                if (recoveryKey.split(" ").length !== 24) {
                    throw new Error("recovery code should have 24 words");
                }
                recoveryKey = bip39.mnemonicToEntropy(recoveryKey);
            }
            const cryptoWorker = await ComlinkCryptoWorker.getInstance();
            const masterKey = await cryptoWorker.decryptB64(
                keyAttributes.masterKeyEncryptedWithRecoveryKey,
                keyAttributes.masterKeyDecryptionNonce,
                await cryptoWorker.fromHex(recoveryKey),
            );
            await saveKeyInSessionStore(SESSION_KEYS.ENCRYPTION_KEY, masterKey);
            await decryptAndStoreToken(keyAttributes, masterKey);

            setData(LS_KEYS.SHOW_BACK_BUTTON, { value: false });
            router.push(PAGES.CHANGE_PASSWORD);
        } catch (e) {
            log.error("password recovery failed", e);
            setFieldError(t("INCORRECT_RECOVERY_KEY"));
        }
    };

    const showNoRecoveryKeyMessage = () => {
        appContext.setDialogBoxAttributesV2({
            title: t("SORRY"),
            close: {},
            content: t("NO_RECOVERY_KEY_MESSAGE"),
        });
    };

    return (
        <VerticallyCentered>
            <FormPaper>
                <FormPaperTitle>{t("RECOVER_ACCOUNT")}</FormPaperTitle>
                <SingleInputForm
                    callback={recover}
                    fieldType="text"
                    placeholder={t("RECOVERY_KEY_HINT")}
                    buttonText={t("RECOVER")}
                    disableAutoComplete
                />
                <FormPaperFooter style={{ justifyContent: "space-between" }}>
                    <LinkButton onClick={showNoRecoveryKeyMessage}>
                        {t("NO_RECOVERY_KEY")}
                    </LinkButton>
                    <LinkButton onClick={router.back}>
                        {t("GO_BACK")}
                    </LinkButton>
                </FormPaperFooter>
            </FormPaper>
        </VerticallyCentered>
    );
}
