import ChangeEmailForm from "@ente/accounts/components/ChangeEmail";
import { PAGES } from "@ente/accounts/constants/pages";
import type { PageProps } from "@ente/shared/apps/types";
import { VerticallyCentered } from "@ente/shared/components/Container";
import FormPaper from "@ente/shared/components/Form/FormPaper";
import FormPaperTitle from "@ente/shared/components/Form/FormPaper/Title";
import { getData, LS_KEYS } from "@ente/shared/storage/localStorage";
import { t } from "i18next";
import { useRouter } from "next/router";
import { useEffect } from "react";

function ChangeEmailPage({ appName, appContext }: PageProps) {
    const router = useRouter();

    useEffect(() => {
        const user = getData(LS_KEYS.USER);
        if (!user?.token) {
            router.push(PAGES.ROOT);
        }
    }, []);

    return (
        <VerticallyCentered>
            <FormPaper>
                <FormPaperTitle>{t("CHANGE_EMAIL")}</FormPaperTitle>
                <ChangeEmailForm appName={appName} appContext={appContext} />
            </FormPaper>
        </VerticallyCentered>
    );
}

export default ChangeEmailPage;
