"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { AuthClient } from "@dfinity/auth-client";
import { Actor, HttpAgent, ActorSubclass } from "@dfinity/agent";
import { idlFactory } from "../../declarations/tradeweaver_backend/tradeweaver_backend.did.js";
import type { _SERVICE } from "../../declarations/tradeweaver_backend/tradeweaver_backend.did";

const CANISTER_ID = process.env.NEXT_PUBLIC_CANISTER_ID_TRADEWEAVER_BACKEND || "uxrrr-q7777-77774-qaaaq-cai";
const DFX_NETWORK = process.env.NEXT_PUBLIC_DFX_NETWORK || "local";
const HOST = DFX_NETWORK === "local" ? "http://127.0.0.1:4943" : "https://icp0.io";

interface ICPContextType {
    isAuthenticated: boolean;
    isLoading: boolean;
    principal: string | null;
    login: () => Promise<void>;
    logout: () => Promise<void>;
    actor: ActorSubclass<_SERVICE> | null;
}

const ICPContext = createContext<ICPContextType | null>(null);

export function ICPProvider({ children }: { children: ReactNode }) {
    const [authClient, setAuthClient] = useState<AuthClient | null>(null);
    const [actor, setActor] = useState<ActorSubclass<_SERVICE> | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [principal, setPrincipal] = useState<string | null>(null);

    useEffect(() => {
        initAuth();
    }, []);

    const initAuth = async () => {
        try {
            const client = await AuthClient.create();
            setAuthClient(client);

            const isAuth = await client.isAuthenticated();
            setIsAuthenticated(isAuth);

            if (isAuth) {
                await updateActor(client);
            } else {
                await createAnonymousActor();
            }
        } catch (error) {
            console.error("Failed to init auth:", error);
            await createAnonymousActor();
        } finally {
            setIsLoading(false);
        }
    };

    const createAnonymousActor = async () => {
        const agent = new HttpAgent({ host: HOST });

        if (DFX_NETWORK === "local") {
            await agent.fetchRootKey().catch(console.error);
        }

        const newActor = Actor.createActor<_SERVICE>(idlFactory, {
            agent,
            canisterId: CANISTER_ID,
        });
        setActor(newActor);
    };

    const updateActor = async (client: AuthClient) => {
        const identity = client.getIdentity();
        const agent = new HttpAgent({ identity, host: HOST });

        if (DFX_NETWORK === "local") {
            await agent.fetchRootKey().catch(console.error);
        }

        const newActor = Actor.createActor<_SERVICE>(idlFactory, {
            agent,
            canisterId: CANISTER_ID,
        });
        setActor(newActor);
        setPrincipal(identity.getPrincipal().toText());
    };

    const login = async () => {
        if (!authClient) return;

        const identityProvider = DFX_NETWORK === "local"
            ? "http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943"
            : "https://identity.ic0.app";

        await authClient.login({
            identityProvider,
            maxTimeToLive: BigInt(7 * 24 * 60 * 60 * 1000 * 1000 * 1000),
            onSuccess: async () => {
                setIsAuthenticated(true);
                await updateActor(authClient);
            },
        });
    };

    const logout = async () => {
        if (!authClient) return;
        await authClient.logout();
        setIsAuthenticated(false);
        setPrincipal(null);
        await createAnonymousActor();
    };

    return (
        <ICPContext.Provider value={{ isAuthenticated, isLoading, principal, login, logout, actor }}>
            {children}
        </ICPContext.Provider>
    );
}

export const useICP = () => {
    const context = useContext(ICPContext);
    if (!context) throw new Error("useICP must be used within an ICPProvider");
    return context;
};
