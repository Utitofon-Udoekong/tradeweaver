"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Actor, HttpAgent, ActorSubclass, Identity, AnonymousIdentity } from "@dfinity/agent";
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
    const [actor, setActor] = useState<ActorSubclass<_SERVICE> | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [principal, setPrincipal] = useState<string | null>(null);

    useEffect(() => {
        initAuth();
    }, []);

    const initAuth = async () => {
        try {
            await createActor(new AnonymousIdentity());
        } catch (error) {
            console.error("Failed to init:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const createActor = async (identity: Identity) => {
        const agent = new HttpAgent({ identity, host: HOST });

        if (DFX_NETWORK === "local") {
            await agent.fetchRootKey().catch(console.error);
        }

        const newActor = Actor.createActor<_SERVICE>(idlFactory, {
            agent,
            canisterId: CANISTER_ID,
        });
        setActor(newActor);

        const principalId = identity.getPrincipal().toText();
        setPrincipal(principalId);
    };

    const login = async () => {
        // For local dev: just set authenticated (no II canister needed)
        setIsAuthenticated(true);
        setPrincipal("local-dev-user");
    };

    const logout = async () => {
        setIsAuthenticated(false);
        setPrincipal(null);
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
