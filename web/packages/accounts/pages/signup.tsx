import SignUp from "@ente/accounts/components/SignUp";
import { PAGES } from "@ente/accounts/constants/pages";
import { LS_KEYS, getData } from "@ente/shared//storage/localStorage";
import type { PageProps } from "@ente/shared/apps/types";
import { VerticallyCentered } from "@ente/shared/components/Container";
import EnteSpinner from "@ente/shared/components/EnteSpinner";
import FormPaper from "@ente/shared/components/Form/FormPaper";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function SignUpPage({ appContext, appName }: PageProps) {
    const [loading, setLoading] = useState(true);

    const router = useRouter();

    useEffect(() => {
        const user = getData(LS_KEYS.USER);
        if (user?.email) {
            router.push(PAGES.VERIFY);
        }
        setLoading(false);
        appContext.showNavBar(true);
    }, []);

    const login = () => {
        router.push(PAGES.LOGIN);
    };

    return (
        <VerticallyCentered>
            {loading ? (
                <EnteSpinner />
            ) : (
                <FormPaper>
                    <SignUp login={login} router={router} appName={appName} />
                </FormPaper>
            )}
        </VerticallyCentered>
    );
}
