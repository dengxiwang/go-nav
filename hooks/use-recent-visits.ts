"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NavSite } from "@/types";

const STORAGE_KEY = "go-nav-recent-visits";
const EVENT_KEY = "go-nav-recent-visits-update";
const MAX_ITEMS = 50;

export interface RecentVisit {
	url: string;
	intranetUrl?: string;
	title: string;
	icon?: string;
	previewImage?: string;
	description?: string;
	bgColor?: string;
	iconPadding?: string;
	timestamp: number;
}

const EMPTY_VISITS: RecentVisit[] = [];
// 路由切换时组件会卸载，但模块仍然存活。保留这份短期缓存，
// 让返回首页时近期访问区可以在首个客户端渲染就复用已有数据，
// 避免恢复滚动位置后再插入一块内容导致页面高度变化。
let cachedVisits: RecentVisit[] = EMPTY_VISITS;

function readVisits(): RecentVisit[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			cachedVisits = EMPTY_VISITS;
			return EMPTY_VISITS;
		}
		const parsed = JSON.parse(raw);
		cachedVisits = Array.isArray(parsed) ? parsed : EMPTY_VISITS;
		return cachedVisits;
	} catch {
		cachedVisits = EMPTY_VISITS;
		return EMPTY_VISITS;
	}
}

function writeVisits(visits: RecentVisit[]) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(visits));
	} catch {
		// ignore
	}
}

function sameVisits(a: RecentVisit[], b: RecentVisit[]) {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (
			a[i].url !== b[i].url ||
			a[i].title !== b[i].title ||
			a[i].timestamp !== b[i].timestamp
		) {
			return false;
		}
	}
	return true;
}

export function recordVisit(site: NavSite) {
	if (typeof window === "undefined") return;
	const visits = readVisits();
	const key = `${site.url}::${site.title}`;
	const filtered = visits.filter((v) => `${v.url}::${v.title}` !== key);
	const entry: RecentVisit = {
		url: site.url,
		intranetUrl: site.intranetUrl,
		title: site.title,
		icon: site.icon,
		previewImage: site.previewImage,
		description: site.description,
		bgColor: site.bgColor,
		iconPadding: site.iconPadding,
		timestamp: Date.now(),
	};
	const next = [entry, ...filtered].slice(0, MAX_ITEMS);
	cachedVisits = next;
	writeVisits(next);
	window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: next }));
}

export function useRecentVisits() {
	const [visits, setVisits] = useState<RecentVisit[]>(() => cachedVisits);
	const [mounted, setMounted] = useState(false);
	const syncRef = useRef(false);

	const sync = useCallback(() => {
		const next = readVisits();
		setVisits((prev) => (sameVisits(prev, next) ? prev : next));
	}, []);

	useEffect(() => {
		setMounted(true);
		sync();
	}, [sync]);

	useEffect(() => {
		const handler = (e: Event) => {
			const next = (e as CustomEvent<RecentVisit[]>).detail;
			if (!Array.isArray(next)) return;
			cachedVisits = next;
			setVisits((prev) => (sameVisits(prev, next) ? prev : next));
		};
		window.addEventListener(EVENT_KEY, handler);
		return () => window.removeEventListener(EVENT_KEY, handler);
	}, []);

	useEffect(() => {
		if (!mounted) return;

		const onFocus = () => {
			if (!syncRef.current) {
				syncRef.current = true;
				sync();
				setTimeout(() => {
					syncRef.current = false;
				}, 500);
			}
		};
		window.addEventListener("focus", onFocus);
		return () => window.removeEventListener("focus", onFocus);
	}, [mounted, sync]);

	const clearVisits = useCallback(() => {
		cachedVisits = EMPTY_VISITS;
		writeVisits(EMPTY_VISITS);
		setVisits((prev) => (prev.length === 0 ? prev : EMPTY_VISITS));
		window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: EMPTY_VISITS }));
	}, []);

	return { visits, clearVisits, mounted };
}
