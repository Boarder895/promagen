Q1) Do all stock exchanges have supported index data (in Marketstack)?

No. In Marketstack, exchanges and indices are two separate “catalogues”. The docs are explicit that the Exchanges endpoint lists 2700+ exchanges, but not all of them are supported by other endpoints (so you can’t assume index coverage just because an exchange exists).
Likewise, the Index List endpoint returns a separate list of supported index “benchmarks” (and that list is not “one per exchange”).

So the right mental model is: Exchange coverage ≠ Index coverage.

Exchange → corresponding index (benchmarks)

Marketstack does not provide a built-in “exchange → index” mapping in the docs; you typically map them by country/market convention (e.g., Germany → DE40/DAX; Japan → JP225/Nikkei, etc.). Below is a practical mapping using Marketstack-style benchmark codes (the same style shown in their indexlist/indexinfo docs).

Legend: I list the most common/representative index benchmarks per exchange. Some markets have multiple major indices, so you’ll see more than one.

United States (broad indices used across US venues)
Stock exchange	Corresponding index benchmark(s)
NASDAQ - All Markets	us100, us500, us1000
New York Stock Exchange (NYSE)	us30, us500, us1000, use_all_share
NYSE Arca	us500, use_all_share (no dedicated “Arca-only” benchmark typically used)
NYSE American	us500, use_all_share (same idea)
Cboe (incl. BZX) / IEX (venues)	us500 (venue is not usually the benchmark source; the market is)
OTC Markets categories (OTC Link / OTCQB / OTCQX / Pink / Grey / “Other OTC”)	No dedicated benchmark is standard → use broad US benchmarks like us500 / use_all_share if you need a market proxy
Canada
Stock exchange	Corresponding index benchmark(s)
Toronto Stock Exchange (TSX)	tsx
UK & Ireland
Stock exchange	Corresponding index benchmark(s)
London Stock Exchange (LSE)	gb100, lsx_composite
Euronext Dublin / Irish market	iseq
Euronext (by country market)
Stock exchange	Corresponding index benchmark(s)
Euronext Paris	fr40
Euronext Amsterdam	nl25
Euronext Brussels	be20
Euronext Lisbon	psi_20, psi, psi_geral
Germany / Switzerland / Austria
Stock exchange	Corresponding index benchmark(s)
Deutsche Börse / Xetra / Frankfurt	de40, mdax, sdax, de_mid, de_small
SIX Swiss Exchange / Switzerland	ch20, ch50
Vienna Stock Exchange	atx
Southern & Eastern Europe
Stock exchange	Corresponding index benchmark(s)
Borsa Italiana	it40
BME Spain	es35
Warsaw Stock Exchange	wig
Budapest Stock Exchange	bux
Bucharest Stock Exchange	bet
Zagreb Stock Exchange	crobex
Cyprus Stock Exchange	cse_general
Belgrade Stock Exchange	belex_15
Ukraine (PFTS)	pfts
Athens Stock Exchange	athens_general (where available)
Nordics & Baltics (Nasdaq Nordic/Baltic markets)
Stock exchange	Corresponding index benchmark(s)
Nasdaq Stockholm	stockholm_30, stockholm
Nasdaq Helsinki	helsinki_25, helsinki
Nasdaq Copenhagen	copenhagen
Nasdaq Tallinn	tallinn
Nasdaq Riga	riga
Nasdaq Vilnius	vilnius
Oslo Børs	oslo
Middle East
Stock exchange	Corresponding index benchmark(s)
Abu Dhabi Securities Exchange	adx_general
Dubai Financial Market	dfm_general
Amman Stock Exchange (Jordan)	ase
Beirut Stock Exchange	blom
Bahrain Bourse	estirad
Tehran Stock Exchange	tedpix
Africa
Stock exchange	Corresponding index benchmark(s)
Johannesburg Stock Exchange	jse
Mauritius	semdex
Asia-Pacific
Stock exchange	Corresponding index benchmark(s)
Australian Securities Exchange (ASX)	asx200, australia_all_ordinaries, asx_all_share, au50
Tokyo Stock Exchange	jp225, jpvix
Hong Kong Stock Exchange	hk50
Shanghai Stock Exchange	shanghai, shanghai_50, csi_300
Shenzhen Stock Exchange	csi_300 (often used as a mainland proxy)
Bombay Stock Exchange (BSE)	sensex
National Stock Exchange of India (NSE)	nifty_50
Stock Exchange of Thailand (SET)	set_50
Colombo Stock Exchange (Sri Lanka)	aspi
Dhaka Stock Exchange	dsei
Latin America
Stock exchange	Corresponding index benchmark(s)
B3 (Brazil)	ibovespa
Colombia (BVC)	colcap
