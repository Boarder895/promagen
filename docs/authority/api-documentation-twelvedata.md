<!-- Promagen note (reference snapshot) -->

# Twelve Data documentation (reference snapshot)

This file is kept in-repo as a raw vendor reference so Promagen work can continue offline.
It is **not** Promagen authority.

Promagen authority lives in:

- `docs/authority/promagen-api-brain-v2.md` (provider behaviour, API calming, budgets)
- `docs/authority/ai providers.md` (provider policy)
- `docs/authority/paid_tier.md` (monetisation SSOT)

---

Overview
Welcome to Twelve Data developer docs — your gateway to comprehensive financial market data through a powerful and easy-to-use API. Twelve Data provides access to financial markets across over 50 global countries, covering more than 1 million public instruments, including stocks, forex, ETFs, mutual funds, commodities, and cryptocurrencies.

Quickstart
To get started, you'll need to sign up for an API key. Once you have your API key, you can start making requests to the API.

Step 1: Create Twelve Data account
Sign up on the Twelve Data website to create your account here. This gives you access to the API dashboard and your API key.

Step 2: Get your API key
After signing in, navigate to your dashboard to find your unique API key. This key is required to authenticate all API and WebSocket requests.

Step 3: Make your first request
Try a simple API call with cURL to fetch the latest price for Apple (AAPL):

curl "https://api.twelvedata.com/price?symbol=AAPL&apikey=your_api_key"
Step 4: Make a request from Python or Javascript
Use our client libraries or standard HTTP clients to make API calls programmatically. Here’s an example in Python and JavaScript:

Python (using official Twelve Data SDK):
from twelvedata import TDClient

# Initialize client with your API key

td = TDClient(apikey="your_api_key")

# Get latest price for Apple

price = td.price(symbol="AAPL").as_json()

print(price)
JavaScript (Node.js):
const fetch = require('node-fetch');

fetch('https://api.twelvedata.com/price?symbol=AAPL&apikey=your_api_key')
.then(response => response.json())
.then(data => console.log(data));
Step 5: Perform correlation analysis between Tesla and Microsoft prices
Fetch historical price data for Tesla (TSLA) and Microsoft (MSFT) and calculate the correlation of their closing prices:

from twelvedata import TDClient
import pandas as pd

# Initialize client with your API key

td = TDClient(apikey="your_api_key")

# Fetch historical price data for Tesla

tsla_ts = td.time_series(
symbol="TSLA",
interval="1day",
outputsize=100
).as_pandas()

# Fetch historical price data for Microsoft

msft_ts = td.time_series(
symbol="MSFT",
interval="1day",
outputsize=100
).as_pandas()

# Align data on datetime index

combined = pd.concat(
[tsla_ts['close'].astype(float), msft_ts['close'].astype(float)],
axis=1,
keys=["TSLA", "MSFT"]
).dropna()

# Calculate correlation

correlation = combined["TSLA"].corr(combined["MSFT"])
print(f"Correlation of closing prices between TSLA and MSFT: {correlation:.2f}")
Authentication
Authenticate your requests using one of these methods:

Query parameter method
GET https://api.twelvedata.com/endpoint?symbol=AAPL&apikey=your_api_key
HTTP header method (recommended)
Authorization: apikey your_api_key
API key useful information
Twelve Data’s demo key (apikey=demo) appears in many vendor examples below — treat it as a placeholder and always replace it with your real key; Promagen must never use the demo key in any environment.
Personal API key required for full access

## Promagen operational note (Vercel Pro)

- Canonical platform hardening: `C:\Users\Proma\Projects\promagen\docs\authority\vercel-pro-promagen-playbook.md`
- Treat TwelveData as _paid-upstream_: protect `/api/fx` with WAF + Spend Management thresholds, and enforce TTL caching so you are not paying per visitor.
- Use kill-switch env vars for emergency response (e.g. `PROMAGEN_DISABLE_TWELVEDATA=1`, `PROMAGEN_SAFE_MODE=1`).
  Premium endpoints and data require higher-tier plans (testable with trial symbols)
  API endpoints
  Service Base URL
  REST API https://api.twelvedata.com
  WebSocket wss://ws.twelvedata.com
  Parameter guidelines
  Separator: Use & to separate multiple parameters
  Case sensitivity: Parameter names are case-insensitive
  symbol=AAPL = symbol=aapl
  Multiple values: Separate with commas where supported
  Response handling
  Default format
  All responses return JSON format by default unless otherwise specified.

Null values
Important: Some response fields may contain null values when data is unavailable for specific metrics. This is expected behavior, not an error.

Best Practices:
Always implement null value handling in your application
Use defensive programming techniques for data processing
Consider fallback values or error handling for critical metrics
Error handling
Structure your code to gracefully handle:

Network timeouts
Rate limiting responses
Invalid parameter errors
Data unavailability periods
Best practices
Rate limits: Adhere to your plan’s rate limits to avoid throttling. Check your dashboard for details.
Error handling: Implement retry logic for transient errors (e.g., 429 Too Many Requests).
Caching: Cache responses for frequently accessed data to reduce API calls and improve performance.
Secure storage: Store your API key securely and never expose it in client-side code or public repositories.
Errors
Twelve Data API employs a standardized error response format, delivering a JSON object with code, message, and status keys for clear and consistent error communication.

Codes
Below is a table of possible error codes, their HTTP status, meanings, and resolution steps:

Code status Meaning Resolution
400 Bad Request Invalid or incorrect parameter(s) provided. Check the message in the response for details. Refer to the API Documenta­tion to correct the input.
401 Unauthor­ized Invalid or incorrect API key. Verify your API key is correct. Sign up for a key here.
403 Forbidden API key lacks permissions for the requested resource (upgrade required). Upgrade your plan here.
404 Not Found Requested data could not be found. Adjust parameters to be less strict as they may be too restrictive.
414 Parameter Too Long Input parameter array exceeds the allowed length. Follow the message guidance to adjust the parameter length.
429 Too Many Requests API request limit reached for your key. Wait briefly or upgrade your plan here.
500 Internal Server Error Server-side issue occurred; retry later. Contact support here for assistance.
Example error response
Consider the following invalid request:

https://api.twelvedata.com/time_series?symbol=AAPL&interval=0.99min&apikey=your_api_key
Due to the incorrect interval value, the API returns:

{
"code": 400,
"message": "Invalid **interval** provided: 0.99min. Supported intervals: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 8h, 1day, 1week, 1month",
"status": "error"
}
Refer to the API Documentation for valid parameter values to resolve such errors.

Libraries
Twelve Data provides a growing ecosystem of libraries and integrations to help you build faster and smarter in your preferred environment. Official libraries are actively maintained by the Twelve Data team, while selected community-built libraries offer additional flexibility.

A full list is available on our GitHub profile.

Official SDKs
Python: twelvedata-python
R: twelvedata-r-sdk
AI integrations
Twelve Data MCP Server: Repository — Model Context Protocol (MCP) server that provides seamless integration with AI assistants and language models, enabling direct access to Twelve Data's financial market data within conversational interfaces and AI workflows.
Spreadsheet add-ons
Excel: Excel Add-in
Google Sheets: Google Sheets Add-on
Community libraries
The community has developed libraries in several popular languages. You can explore more community libraries on GitHub.

C#: TwelveDataSharp
JavaScript: twelvedata
PHP: twelvedata
Go: twelvedata
TypeScript: twelve-data-wrapper
Other Twelve Data repositories
searchindex (Go): Repository — In-memory search index by strings
ws-tools (Python): Repository — Utility tools for WebSocket stream handling
API specification
OpenAPI / Swagger: Access the complete API specification in OpenAPI format. You can use this file to automatically generate client libraries in your preferred programming language, explore the API interactively via Swagger tools, or integrate Twelve Data seamlessly into your AI and LLM workflows.
Market data
Access real-time and historical market prices—time series and exchange rates—for equities, forex, cryptocurrencies, ETFs, and more. These endpoints form the foundation for any trading or data-driven application.

Time series
High demand
/time_series
The time series endpoint provides detailed historical data for a specified financial instrument. It returns two main components: metadata, which includes essential information about the instrument, and a time series dataset. The time series consists of chronological entries with Open, High, Low, and Close prices, and for applicable instruments, it also includes trading volume. This endpoint is ideal for retrieving comprehensive historical price data for analysis or visualization purposes.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/time_series?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock"
},
"values": [
{
"datetime": "2021-09-16 15:59:00",
"open": "148.73500",
"high": "148.86000",
"low": "148.73000",
"close": "148.85001",
"volume": "624277"
}
],
"status": "ok"
}
Time series cross
/time_series/cross
The Time Series Cross endpoint calculates and returns historical cross-rate data for exotic forex pairs, cryptocurrencies, or stocks (e.g., Apple Inc. price in Indian Rupees) on the fly. It provides metadata about the requested symbol and a time series array with Open, High, Low, and Close prices, sorted descending by time, enabling analysis of price history and market trends.

API credits cost

5 per symbol

Parameters
Response
base

string
Base currency symbol

Example: JPY

base_type

string
Base instrument type according to the /instrument_type endpoint

Example: Physical Currency

base_exchange

string
Base exchange

Example: Binance

base_mic_code

string
Base MIC code

Example: XNGS

quote

string
Quote currency symbol

Example: BTC

quote_type

string
Quote instrument type according to the /instrument_type endpoint

Example: Digital Currency

quote_exchange

string
Quote exchange

Example: Coinbase

quote_mic_code

string
Quote MIC code

Example: XNYS

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 1day, 1week, 1month

Example: 1min

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Example: 30

format

string
Format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
Delimiter used in CSV file

Default: ;

prepost

boolean
Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume.

Default: false

start_date

string
Start date for the time series data

Example: 2025-01-01

end_date

string
End date for the time series data

Example: 2025-01-31

adjust

boolean
Specifies if there should be an adjustment

Default: true

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive.

Default: 5

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here.
   Take note that the IANA Timezone name is case-sensitive
   Example: UTC

Request example

https://api.twelvedata.com/time_series/cross?base=JPY&quote=BTC&interval=1min&apikey=demo
Response

{
"meta": {
"base_instrument": "JPY/USD",
"base_currency": "",
"base_exchange": "PHYSICAL CURRENCY",
"interval": "1min",
"quote_instrument": "BTC/USD",
"quote_currency": "",
"quote_exchange": "Coinbase Pro"
},
"values": [
{
"datetime": "2025-02-28 14:30:00",
"open": "0.0000081115665",
"high": "0.0000081273069",
"low": "0.0000081088287",
"close": "0.0000081268066"
}
]
}
Quote
High demand
/quote
The quote endpoint provides real-time data for a selected financial instrument, returning essential information such as the latest price, open, high, low, close, volume, and price change. This endpoint is ideal for users needing up-to-date market data to track price movements and trading activity for specific stocks, ETFs, or other securities.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG000BHTMY7

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval of the quote

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 1day, 1week, 1month

Default: 1day

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
Country where instrument is traded, e.g., United States or US

Example: United States

volume_time_period

integer
Number of periods for Average Volume

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: ETF

format

string
Value can be JSON or CSV Default JSON

Supports: JSON, CSV

Default: JSON

delimiter

string
Specify the delimiter used when downloading the CSV file

Default: ;

prepost

boolean
Parameter is optional. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume.

Default: false

eod

boolean
If true, then return data for closed day

Supports: true, false

Default: false

rolling_period

integer
Number of hours for calculate rolling change at period. By default set to 24, it can be in range [1, 168].

Default: 24

dp

integer
Specifies the number of decimal places for floating values Should be in range [0,11] inclusive

Default: 5

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here.
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

Request example

https://api.twelvedata.com/quote?symbol=AAPL&apikey=demo
Response

{
"symbol": "AAPL",
"name": "Apple Inc",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"currency": "USD",
"datetime": "2021-09-16",
"timestamp": 1631772000,
"last_quote_at": 1631772000,
"open": "148.44000",
"high": "148.96840",
"low": "147.22099",
"close": "148.85001",
"volume": "67903927",
"previous_close": "149.09000",
"change": "-0.23999",
"percent_change": "-0.16097",
"average_volume": "83571571",
"rolling_1d_change": "123.123",
"rolling_7d_change": "123.123",
"rolling_change": "123.123",
"is_market_open": false,
"fifty_two_week": {
"low": "103.10000",
"high": "157.25999",
"low_change": "45.75001",
"high_change": "-8.40999",
"low_change_percent": "44.37440",
"high_change_percent": "-5.34782",
"range": "103.099998 - 157.259995"
},
"extended_change": "0.09",
"extended_percent_change": "0.05",
"extended_price": "125.22",
"extended_timestamp": "1649845281"
}
Latest price
High demand
/price
The latest price endpoint provides the latest market price for a specified financial instrument. It returns a single data point representing the current (or the most recently available) trading price.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG000BHTMY7

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
Country where instrument is traded, e.g., United States or US

Example: United States

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: ETF

format

string
Value can be JSON or CSV

Supports: JSON, CSV

Default: JSON

delimiter

string
Specify the delimiter used when downloading the CSV file

Default: ;

prepost

boolean
Parameter is optional. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume.

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0,11] inclusive

Default: 5

Request example

https://api.twelvedata.com/price?symbol=AAPL&apikey=demo
Response

{
"price": "200.99001"
}
End of day price
/eod
The End of Day (EOD) Prices endpoint provides the closing price and other relevant metadata for a financial instrument at the end of a trading day. This endpoint is useful for retrieving daily historical data for stocks, ETFs, or other securities, allowing users to track performance over time and compare daily market movements.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG000BHTMY7

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
Country where instrument is traded, e.g., United States or US

Example: United States

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: ETF

date

string
If not null, then return data from a specific date

Example: 2006-01-02

prepost

boolean
Parameter is optional. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values Should be in range [0,11] inclusive

Default: 5

Request example

https://api.twelvedata.com/eod?symbol=AAPL&apikey=demo
Response

{
"symbol": "AAPL",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"currency": "USD",
"datetime": "2021-09-16",
"close": "148.79"
}
Market movers
/market_movers/{market}
The market movers endpoint provides a ranked list of the top-gaining and losing assets for the current trading day. It returns detailed data on the highest percentage price increases and decreases since the previous day's close. This endpoint supports international equities, forex, and cryptocurrencies, enabling users to quickly identify significant market movements across various asset classes.

API credits cost

100 per request

This API endpoint is available starting with the Pro plan.
Parameters
Response
market

string
Maket type

Supports: stocks, etf, mutual_funds, forex, crypto

Example: stocks

direction

string
Specifies direction of the snapshot gainers or losers

Supports: gainers, losers

Default: gainers

outputsize

integer
Specifies the size of the snapshot. Can be in a range from 1 to 50

Default: 30

country

string
Country of the snapshot, applicable to non-currencies only. Takes country name or alpha code

Default: USA

price_greater_than

string
Takes values with price grater than specified value

Example: 175.5

dp

string
Specifies the number of decimal places for floating values. Should be in range [0,11] inclusive

Default: 5

Request example

https://api.twelvedata.com/market_movers/stocks?apikey=demo
Response

{
"values": [
{
"symbol": "BSET",
"name": "Bassett Furniture Industries Inc",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"datetime": "2023-10-01 12:00:00Z",
"last": 17.25,
"high": 18,
"low": 16.5,
"volume": 108297,
"change": 3.31,
"percent_change": 23.74462
}
],
"status": "ok"
}
Reference data
Lookup static metadata—symbol lists, exchange details, currency information-to filter, validate, and contextualize your core data calls. Ideal for building dropdowns, mappings, and ensuring data consistency.

Asset catalogs
Stocks
/stocks
The stocks endpoint provides a daily updated list of all available stock symbols. It returns an array containing the symbols, which can be used to identify and access specific stock data across various services. This endpoint is essential for users needing to retrieve the latest stock symbol information for further data requests or integration into financial applications.

API credits cost

1 per request

Parameters
Response
symbol

string
The ticker symbol of an instrument for which data is requested

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG000B9Y5X2

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

cik

string
The CIK of an instrument for which data is requested

Example: 95953

exchange

string
Filter by exchange name

Example: NASDAQ

mic_code

string
Filter by market identifier code (MIC) under ISO 10383 standard

Example: XNGS

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Index, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

show_plan

boolean
Adds info on which plan symbol is available

Default: false

include_delisted

boolean
Include delisted identifiers

Default: false

Request example

https://api.twelvedata.com/stocks?apikey=demo
Response

{
"data": [
{
"symbol": "AAPL",
"name": "Apple Inc",
"currency": "USD",
"exchange": "NASDAQ",
"mic_code": "XNGS",
"country": "United States",
"type": "Common Stock",
"figi_code": "BBG000B9Y5X2",
"cfi_code": "ESVUFR",
"isin": "US0378331005",
"cusip": "037833100",
"access": {
"global": "Basic",
"plan": "Basic"
}
}
],
"status": "ok"
}
Forex pairs
/forex_pairs
The forex pairs endpoint provides a comprehensive list of all available foreign exchange currency pairs. It returns an array of forex pairs, which is updated daily.

API credits cost

1 per request

Parameters
Response
symbol

string
The ticker symbol of an instrument for which data is requested

Example: EUR/USD

currency_base

string
Filter by currency base

Example: EUR

currency_quote

string
Filter by currency quote

Example: USD

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

Request example

https://api.twelvedata.com/forex_pairs?apikey=demo
Response

{
"data": [
{
"symbol": "EUR/USD",
"currency_group": "Major",
"currency_base": "EUR",
"currency_quote": "USD"
}
],
"status": "ok"
}
Cryptocurrency pairs
/cryptocurrencies
The cryptocurrencies endpoint provides a daily updated list of all available cryptos. It returns an array containing detailed information about each cryptocurrency, including its symbol, name, and other relevant identifiers. This endpoint is useful for retrieving a comprehensive catalog of cryptocurrencies for applications that require up-to-date market listings or need to display available crypto assets to users.

API credits cost

1 per request

Parameters
Response
symbol

string
The ticker symbol of an instrument for which data is requested

Example: BTC/USD

exchange

string
Filter by exchange name. E.g. Binance, Coinbase, etc.

Example: Binance

currency_base

string
Filter by currency base

Example: BTC

currency_quote

string
Filter by currency quote

Example: USD

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

Request example

https://api.twelvedata.com/cryptocurrencies?apikey=demo
Response

{
"data": [
{
"symbol": "BTC/USD",
"available_exchanges": [
"ABCC",
"Allcoin",
"BTC-Alpha",
"BTCTurk",
"Bibox",
"n.exchange",
"p2pb2b",
"xBTCe"
],
"currency_base": "Bitcoin",
"currency_quote": "US Dollar"
}
],
"status": "ok"
}
ETFs
/etfs
The ETFs endpoint provides a daily updated list of all available Exchange-Traded Funds. It returns an array containing detailed information about each ETF, including its symbol, name, and other relevant identifiers. This endpoint is useful for retrieving a comprehensive catalog of ETFs for portfolio management, investment tracking, or financial analysis.

API credits cost

1 per request

Parameters
Response
symbol

string
The ticker symbol of an instrument for which data is requested

Example: SPY

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG000BDTF76

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

cik

string
The CIK of an instrument for which data is requested

Example: 95953

exchange

string
Filter by exchange name

Example: NYSE

mic_code

string
Filter by market identifier code (MIC) under ISO 10383 standard

Example: XNYS

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

show_plan

boolean
Adds info on which plan symbol is available

Default: false

include_delisted

boolean
Include delisted identifiers

Default: false

Request example

https://api.twelvedata.com/etfs?apikey=demo
Response

{
"data": [
{
"symbol": "SPY",
"name": "SPDR S&P 500 ETF Trust",
"currency": "USD",
"exchange": "NYSE",
"mic_code": "ARCX",
"country": "United States",
"figi_code": "BBG000BDTF76",
"cfi_code": "CECILU",
"isin": "US78462F1030",
"cusip": "037833100",
"access": {
"global": "Basic",
"plan": "Basic"
}
}
],
"status": "ok"
}
Funds
/funds
The funds endpoint provides a daily updated list of available investment funds. It returns an array containing detailed information about each fund, including identifiers, names, and other relevant attributes.

API credits cost

1 per request

Parameters
Response
symbol

string
The ticker symbol of an instrument for which data is requested

Example: FXAIX

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG000BHTMY7

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

cik

string
The CIK of an instrument for which data is requested

Example: 95953

exchange

string
Filter by exchange name

Example: Nasdaq

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

show_plan

boolean
Adds info on which plan symbol is available

Default: false

page

integer
Page number of the results to fetch

Default: 1

outputsize

integer
Determines the number of data points returned in the output

Default: 5000

Request example

https://api.twelvedata.com/funds?apikey=demo
Response

{
"result": {
"count": 84799,
"list": [
{
"symbol": "DIVI",
"name": "AdvisorShares Athena High Dividend ETF",
"country": "United States",
"currency": "USD",
"exchange": "NYSE",
"mic_code": "ARCX",
"type": "ETF",
"figi_code": "BBG00161BCW4",
"cfi_code": "CECILU",
"isin": "GB00B65TLW28",
"cusip": "35473P108",
"access": {
"global": "Basic",
"plan": "Basic"
}
}
]
},
"status": "ok"
}
Commodities
/commodities
The commodities endpoint provides a daily updated list of available commodity pairs, across precious metals, livestock, softs, grains, etc.

API credits cost

1 per request

Parameters
Response
symbol

string
The ticker symbol of an instrument for which data is requested

Example: XAU/USD

category

string
Filter by category of commodity

Example: Precious Metal

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

Request example

https://api.twelvedata.com/commodities?apikey=demo
Response

{
"data": [
{
"category": "Agricultural Product",
"description": "Standardized contract to buy or sell a set quantity of corn at a future date.",
"name": "Corn Futures",
"symbol": "C_1"
},
{
"category": "Agricultural Product",
"description": "Agreement to transact cocoa beans at a predetermined price and date.",
"name": "Cocoa Futures",
"symbol": "CC1"
},
{
"category": "Precious Metal",
"description": "Spot price per troy ounce of gold.",
"name": "Gold Spot",
"symbol": "XAU/USD"
}
],
"status": "ok"
}
Fixed income
/bonds
The fixed income endpoint provides a daily updated list of available bonds. It returns an array containing detailed information about each bond, including identifiers, names, and other relevant attributes.

API credits cost

1 per request

Parameters
Response
symbol

string
The ticker symbol of an instrument for which data is requested

Example: US2Y

exchange

string
Filter by exchange name

Example: NYSE

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

show_plan

boolean
Adds info on which plan symbol is available

Default: false

page

integer
Page number of the results to fetch

Default: 1

outputsize

integer
Determines the number of data points returned in the output

Default: 5000

Request example

https://api.twelvedata.com/bonds?apikey=demo
Response

{
"result": {
"count": 6,
"list": [
{
"symbol": "US2Y",
"name": "US Treasury Yield 2 Years",
"country": "United States",
"currency": "USD",
"exchange": "NYSE",
"mic_code": "XNYS",
"type": "Bond",
"access": {
"global": "Basic",
"plan": "Basic"
}
}
]
},
"status": "ok"
}
Discovery
Symbol search
High demand
/symbol_search
The symbol search endpoint allows users to find financial instruments by name or symbol. It returns a list of matching symbols, ordered by relevance, with the most relevant instrument first. This is useful for quickly locating specific stocks, ETFs, or other financial instruments when only partial information is available.

API credits cost

1 per request

Parameters
Response
symbol

string
Symbol to search. Supports:

Ticker symbol of instrument.
International securities identification number (ISIN).
Financial instrument global identifier (FIGI).
Composite FIGI.
Share Class FIGI.
Example: AAPL

outputsize

integer
Number of matches in response. Max 120

Default: 30

show_plan

boolean
Adds info on which plan symbol is available.

Default: false

Request example

https://api.twelvedata.com/symbol_search?symbol=AAPL&apikey=demo
Response

{
"data": [
{
"symbol": "AA",
"instrument_name": "Alcoa Corp",
"exchange": "NYSE",
"mic_code": "XNYS",
"exchange_timezone": "America/New_York",
"instrument_type": "Common Stock",
"country": "United States",
"currency": "USD",
"access": {
"global": "Basic",
"plan": "Basic"
}
}
],
"status": "ok"
}
Cross listings
/cross_listings
The cross_listings endpoint provides a daily updated list of cross-listed symbols for a specified financial instrument. Cross-listed symbols represent the same security available on multiple exchanges. This endpoint is useful for identifying all the exchanges where a particular security is traded, allowing users to access comprehensive trading information across different markets.

API credits cost

40 per request

This API endpoint is available starting with the Grow plan.
Parameters
Response
symbol

string
The ticker symbol of an instrument for which data is requested

Example: AAPL

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market identifier code (MIC) under ISO 10383 standard

Example: XNGS

country

string
Country to which stock exchange belongs to

Example: United States

Request example

https://api.twelvedata.com/cross_listings?symbol=AAPL&apikey=demo
Response

{
"result": {
"count": 4,
"list": [
{
"exchange": "NASDAQ",
"mic_code": "XNGS",
"name": "NVIDIA Corporation",
"symbol": "NVDA"
},
{
"exchange": "VSE",
"mic_code": "XWBO",
"name": "NVIDIA Corporation",
"symbol": "NVDA"
},
{
"exchange": "BVS",
"mic_code": "XSGO",
"name": "NVIDIA Corporation",
"symbol": "NVDACL"
},
{
"exchange": "BVS",
"mic_code": "XSGO",
"name": "NVIDIA Corporation",
"symbol": "NVDA"
}
]
}
}
Earliest timestamp
/earliest_timestamp
The earliest_timestamp endpoint provides the earliest available date and time for a specified financial instrument at a given data interval. This endpoint is useful for determining the starting point of historical data availability for various assets, such as stocks or currencies, allowing users to understand the time range covered by the data.

API credits cost

1 per request

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument.

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI).

Example: BBG000B9XRY4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series.

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 1day, 1week, 1month

Example: 1day

exchange

string
Exchange where instrument is traded.

Example: Nasdaq

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard.

Example: XNAS

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here.
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

Request example

https://api.twelvedata.com/earliest_timestamp?symbol=AAPL&interval=1day&apikey=demo
Response

{
"unix_time": 345479400,
"datetime": "1980-12-12"
}
Markets
Exchanges
High demand
/exchanges
The exchanges endpoint provides a comprehensive list of all available equity exchanges. It returns an array containing detailed information about each exchange, such as exchange code, name, country, and timezone. This data is updated daily.

API credits cost

1 per request

Parameters
Response
type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: ETF

name

string
Filter by exchange name

Example: NASDAQ

code

string
Filter by market identifier code (MIC) under ISO 10383 standard

Example: XBUE

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

show_plan

boolean
Adds info on which plan symbol is available

Default: false

Request example

https://api.twelvedata.com/exchanges?apikey=demo
Response

{
"data": [
{
"title": "Argentinian Stock Exchange",
"name": "BCBA",
"code": "XBUE",
"country": "Argentina",
"timezone": "America/Argentina/Buenos_Aires",
"access": {
"global": "Pro",
"plan": "Pro"
}
}
],
"status": "ok"
}
Exchanges schedule
/exchange_schedule
The exchanges schedule endpoint provides detailed information about various stock exchanges, including their trading hours and operational days. This data is essential for users who need to know when specific exchanges are open for trading, allowing them to plan their activities around the availability of these markets.

API credits cost

100 per request

This API endpoint is available starting with the Ultra plan.
Parameters
Response
date

string
If a date is provided, the API returns the schedule for the specified date; otherwise, it returns the default (common) schedule.

The date can be specified in one of the following formats:
An exact date (e.g., 2021-10-27)
A human-readable keyword: today or yesterday
A full datetime string in UTC (e.g., 2025-04-11T20:00:00) to retrieve the schedule corresponding to the day in the specified time.
When using a datetime value, the resulting schedule will correspond to the local calendar day at the specified time. For example, 2025-04-11T20:00:00 UTC corresponds to:
2025-04-11 in the America/New_York timezone
2025-04-12 in the Australia/Sydney timezone
Example: 2021-10-27

mic_name

string
Filter by exchange name

Example: NASDAQ

mic_code

string
Filter by market identifier code (MIC) under ISO 10383 standard

Example: XNGS

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

Request example

https://api.twelvedata.com/exchange_schedule?apikey=demo
Response

{
"data": [
{
"title": "NASDAQ/NGS (Global Select Market)",
"name": "NASDAQ",
"code": "XNYS",
"country": "United States",
"time_zone": "America/New_York",
"sessions": [
{
"open_time": "04:00:00",
"close_time": "09:30:00",
"session_name": "Pre market",
"session_type": "pre"
}
]
}
]
}
Cryptocurrency exchanges
/cryptocurrency_exchanges
The cryptocurrency exchanges endpoint provides a daily updated list of available cryptocurrency exchanges. It returns an array containing details about each exchange, such as exchange names and identifiers.

API credits cost

1 per request

Parameters
Response
format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
Specify the delimiter used when downloading the CSV file

Default: ;

Request example

https://api.twelvedata.com/cryptocurrency_exchanges?apikey=demo
Response

{
"data": [
{
"name": "Binance"
},
{
"name": "Coinbase Pro"
},
{
"name": "Kraken"
},
{
"name": "OKX"
}
],
"status": "ok"
}
Market state
/market_state
The market state endpoint provides real-time information on the operational status of all available stock exchanges. It returns data on whether each exchange is currently open or closed, along with the time remaining until the next opening or closing. This endpoint is useful for users who need to monitor exchange hours and plan their trading activities accordingly.

API credits cost

1 per request

Parameters
Response
exchange

string
The exchange name where the instrument is traded.

Example: NYSE

code

string
The Market Identifier Code (MIC) of the exchange where the instrument is traded.

Example: XNYS

country

string
The country where the exchange is located. Takes country name or alpha code.

Example: United States

Request example

https://api.twelvedata.com/market_state?apikey=demo
Response

[
{
"name": "NYSE",
"code": "XNYS",
"country": "United States",
"is_market_open": true,
"time_after_open": "02:39:03",
"time_to_open": "00:00:00",
"time_to_close": "05:20:57"
}
]
Supporting metadata
Countries
/countries
The countries endpoint provides a comprehensive list of countries, including their ISO codes, official names, capitals, and currencies. This data is essential for applications requiring accurate country information for tasks such as localization, currency conversion, or geographic analysis.

API credits cost

1 per request

Parameters
Response
No parameters are required
Request example

https://api.twelvedata.com/countries?apikey=demo
Response

{
"data": [
{
"iso2": "US",
"iso3": "USA",
"numeric": "840",
"name": "United States",
"official_name": "United States of America",
"capital": "Washington D.C.",
"currency": "USD"
}
]
}
Instrument type
/instrument_type
The instrument type endpoint lists all available financial instrument types, such as stocks, ETFs, and cryptos. This information is essential for users to identify and categorize different financial instruments when accessing or analyzing market data.

API credits cost

1 per request

Parameters
Response
No parameters are required
Request example

https://api.twelvedata.com/instrument_type?apikey=demo
Response

{
"result": [
"Agricultural Product",
"American Depositary Receipt",
"Bond",
"Bond Fund",
"Closed-end Fund",
"Common Stock",
"Depositary Receipt",
"Digital Currency",
"Energy Resource",
"ETF",
"Exchange-Traded Note",
"Global Depositary Receipt",
"Index",
"Industrial Metal",
"Limited Partnership",
"Livestock",
"Mutual Fund",
"Physical Currency",
"Precious Metal",
"Preferred Stock",
"REIT",
"Right",
"Structured Product",
"Trust",
"Unit",
"Warrant"
],
"status": "ok"
}
Technical indicators
/technical_indicators
The technical indicators endpoint provides a comprehensive list of available technical indicators, each represented as an object. This endpoint is useful for developers looking to integrate a variety of technical analysis tools into their applications, allowing for streamlined access to indicator data without needing to manually configure each one.

API credits cost

1 per request

Parameters
Response
No parameters are required
Request example

https://api.twelvedata.com/technical_indicators?apikey=demo
Response

{
"data": {
"macd": {
"enable": true,
"full_name": "Moving Average Convergence Divergence",
"description": "Moving Average Convergence Divergence(MACD) is ...",
"type": "Momentum Indicators",
"overlay": false,
"output_values": {
"parameter_name": {
"default_color": "#FF0000",
"display": "line",
"min_range": 0,
"max_range": 5
}
},
"parameters": {
"parameter_name": {
"default": 12,
"max_range": 1,
"min_range": 1,
"range": [
"open",
"high",
"low",
"close"
],
"type": "int"
}
},
"tinting": {
"display": "fill",
"color": "#FF0000",
"transparency": 0.5,
"lower_bound": "0",
"upper_bound": "macd"
}
}
},
"status": "ok"
}
Fundamentals
In-depth company and fund financials—income statements, balance sheets, cash flows, profiles, corporate events, and key ratios. Unlock comprehensive datasets for valuation, screening, and fundamental research.

Logo
/logo
The logo endpoint provides the official logo image for a specified company, cryptocurrency, or forex pair. This endpoint is useful for integrating visual branding elements into financial applications, websites, or reports, ensuring that users can easily identify and associate the correct logo with the respective financial asset.

API credits cost

1 per symbol

Parameters
Response
symbol

string
The ticker symbol of an instrument for which data is requested, e.g., AAPL, BTC/USD, EUR/USD.

Example: BTC/USD

exchange

string
The exchange name where the instrument is traded, e.g., NASDAQ, NSE

Example: NASDAQ

mic_code

string
The Market Identifier Code (MIC) of the exchange where the instrument is traded, e.g., XNAS, XLON

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

Request example

https://api.twelvedata.com/logo?symbol=BTC/USD&apikey=demo
Response

{
"meta": {
"symbol": "BTC/USD",
"exchange": "Coinbase Pro"
},
"url": "https://api.twelvedata.com/logo/apple.com",
"logo_base": "https://logo.twelvedata.com/crypto/btc.png",
"logo_quote": "https://logo.twelvedata.com/crypto/usd.png"
}
Profile
Useful
/profile
The profile endpoint provides detailed company information, including the company's name, industry, sector, CEO, headquarters location, and market capitalization. This data is useful for obtaining a comprehensive overview of a company's business and financial standing.

API credits cost

10 per symbol

This API endpoint is available starting with the Grow plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of instrument. For preffered stocks use dot(.) delimiter. E.g. BRK.A or BRK.B will be correct

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
Country where instrument is traded, e.g., United States or US

Example: United States

Request example

https://api.twelvedata.com/profile?symbol=AAPL&apikey=demo
Response

{
"symbol": "AAPL",
"name": "Apple Inc",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"sector": "Technology",
"industry": "Consumer Electronics",
"employees": 147000,
"website": "http://www.apple.com",
"description": "Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and...",
"type": "Common Stock",
"CEO": "Mr. Timothy D. Cook",
"address": "One Apple Park Way",
"address2": "Cupertino, CA 95014",
"city": "Cupertino",
"zip": "95014",
"state": "CA",
"country": "US",
"phone": "408-996-1010"
}
Dividends
/dividends
The dividends endpoint provides historical dividend data for a specified stock, in many cases covering over a decade. It returns information on dividend payouts, including the amount, payment date, and frequency. This endpoint is ideal for users tracking dividend histories or evaluating the income potential of stocks.

API credits cost

20 per symbol

This API endpoint is available starting with the Grow plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of instrument. For preffered stocks use dot(.) delimiter. E.g. BRK.A or BRK.B will be correct

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
Country where instrument is traded, e.g., United States or US

Example: US

range

string
Specifies the time range for which to retrieve dividend data. Accepts values such as last (most recent dividend), next (upcoming dividend), 1m - 5y for respective periods, or full for all available data. If provided together with start_date and/or end_date, this parameter takes precedence.

Supports: last, next, 1m, 3m, 6m, ytd, 1y, 2y, 5y, full

Default: last

start_date

string
Start date for the dividend data query. Only dividends with dates on or after this date will be returned. Format 2006-01-02. If provided together with range parameter, range will take precedence.

Example: 2024-01-01

end_date

string
End date for the dividend data query. Only dividends with dates on or after this date will be returned. Format 2006-01-02. If provided together with range parameter, range will take precedence.

Example: 2024-12-31

adjust

boolean
Specifies if there should be an adjustment

Default: true

Request example

https://api.twelvedata.com/dividends?symbol=AAPL&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"name": "Apple Inc",
"currency": "USD",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"exchange_timezone": "America/New_York"
},
"dividends": [
{
"ex_date": "2021-08-06",
"amount": 0.22
}
]
}
Dividends calendar
/dividends_calendar
The dividends calendar endpoint provides a detailed schedule of upcoming and past dividend events for specified date ranges. By using the start_date and end_date parameters, users can retrieve a list of companies issuing dividends, including the ex-dividend date, payment date, and dividend amount. This endpoint is ideal for tracking dividend payouts and planning investment strategies based on dividend schedules.

API credits cost

40 per symbol

This API endpoint is available starting with the Grow plan.
Parameters
Response
symbol

string
Symbol ticker of instrument. For preffered stocks use dot(.) delimiter. E.g. BRK.A or BRK.B will be correct

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
Country where instrument is traded, e.g., United States or US

Example: US

start_date

string
Start date for the dividends calendar query. Only dividends with ex-dates on or after this date will be returned. Format 2006-01-02

Example: 2024-01-01

end_date

string
End date for the dividends calendar query. Only dividends with ex-dates on or before this date will be returned. Format 2006-01-02

Example: 2024-12-31

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 500. Default 100 when no date parameters are set, otherwise set to maximum

Default: 100

page

integer
Page number

Default: 1

Request example

https://api.twelvedata.com/dividends_calendar?apikey=demo
Response

[
{
"symbol": "MSFT",
"mic_code": "XNGS",
"exchange": "NASDAQ",
"ex_date": "2024-02-14",
"amount": 0.75
}
]
Splits
/splits
The splits endpoint provides historical data on stock split events for a specified company. It returns details including the date of each split and the corresponding split factor.

API credits cost

20 per symbol

This API endpoint is available starting with the Grow plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of instrument. For preffered stocks use dot(.) delimiter. E.g. BRK.A or BRK.B will be correct

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
Country where instrument is traded, e.g., United States or US

Example: United States

range

string
Range of data to be returned

Supports: last, 1m, 3m, 6m, ytd, 1y, 2y, 5y, full

Default: last

start_date

string
The starting date for data selection. Format 2006-01-02

Example: 2020-01-01

end_date

string
The ending date for data selection. Format 2006-01-02

Example: 2020-12-31

Request example

https://api.twelvedata.com/splits?symbol=AAPL&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"name": "Apple Inc",
"currency": "USD",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"exchange_timezone": "America/New_York"
},
"splits": [
{
"date": "2020-08-31",
"description": "4-for-1 split",
"ratio": 0.25,
"from_factor": 4,
"to_factor": 1
}
]
}
Splits calendar
/splits_calendar
The splits calendar endpoint provides a detailed calendar of stock split events within a specified date range. By setting the start_date and end_date parameters, users can retrieve a list of upcoming or past stock splits, including the company name, split ratio, and effective date. This endpoint is useful for tracking changes in stock structure and planning investment strategies around these events.

API credits cost

40 per symbol

This API endpoint is available starting with the Grow plan.
Parameters
Response
symbol

string
Symbol ticker of instrument. For preffered stocks use dot(.) delimiter. E.g. BRK.A or BRK.B will be correct

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
Country where instrument is traded, e.g., United States or US

Example: United States

start_date

string
The starting date (inclusive) for filtering split events in the calendar. Format 2006-01-02

Example: 2024-01-01

end_date

string
The ending date (inclusive) for filtering split events in the calendar. Format 2006-01-02

Example: 2024-12-31

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 500. Default 100 when no date parameters are set, otherwise set to maximum

Default: 100

page

string
Page number

Default: 1

Request example

https://api.twelvedata.com/splits_calendar?apikey=demo
Response

[
{
"date": "1987-06-16",
"symbol": "AAPL",
"mic_code": "XNGS",
"exchange": "NASDAQ",
"description": "2-for-1 split",
"ratio": 0.5,
"from_factor": 2,
"to_factor": 1
}
]
Earnings
/earnings
The earnings endpoint provides comprehensive earnings data for a specified company, including both the estimated and actual Earnings Per Share (EPS) figures. This endpoint delivers historical earnings information, allowing users to track a company's financial performance over time.

API credits cost

20 per symbol

This API endpoint is available starting with the Grow plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of instrument. For preffered stocks use dot(.) delimiter. E.g. BRK.A or BRK.B will be correct

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
Country where instrument is traded, e.g., United States or US

Example: United States

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

period

string
Type of earning, returns only 1 record. When is not empty, dates and outputsize parameters are ignored

Supports: latest, next

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 1000. Default 10 when no date parameters are set, otherwise set to maximum

Default: 10

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

dp

integer
The number of decimal places in the response data. Should be in range [0,11] inclusive

Default: 2

start_date

string
The date from which the data is requested. The date format is YYYY-MM-DD.

Example: 2024-04-01

end_date

string
The date to which the data is requested. The date format is YYYY-MM-DD.

Example: 2024-04-30

Request example

https://api.twelvedata.com/earnings?symbol=AAPL&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"name": "Apple Inc",
"currency": "USD",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"exchange_timezone": "America/New_York"
},
"earnings": [
{
"date": "2020-04-30",
"time": "After Hours",
"eps_estimate": 2.09,
"eps_actual": 2.55,
"difference": 0.46,
"surprise_prc": 22.01
}
],
"status": "ok"
}
Earnings calendar
/earnings_calendar
The earnings calendar endpoint provides a schedule of company earnings announcements for a specified date range. By default, it returns earnings data for the current day. Users can customize the date range using the start_date and end_date parameters to retrieve earnings information for specific periods. This endpoint is useful for tracking upcoming earnings reports and planning around key financial announcements.

API credits cost

40 per request

This API endpoint is available starting with the Grow plan.
Parameters
Response
exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
Country where instrument is traded, e.g., United States or US

Example: United States

format

string
Value can be JSON or CSV

Supports: JSON, CSV

Default: JSON

delimiter

string
Specify the delimiter used when downloading the CSV file

Default: ;

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0,11] inclusive

Default: 2

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Example: 2024-04-01

end_date

string
Can be used separately and together with start_date. Format 2006-01-02 or 2006-01-02T15:04:05

Example: 2024-04-30

Request example

https://api.twelvedata.com/earnings_calendar?apikey=demo
Response

{
"earnings": {
"2020-04-30": [
{
"symbol": "BR",
"name": "Broadridge Financial Solutions Inc",
"currency": "USD",
"exchange": "NYSE",
"mic_code": "XNYS",
"country": "United States",
"time": "Time Not Supplied",
"eps_estimate": 1.72,
"eps_actual": 1.67,
"difference": -0.05,
"surprise_prc": -2.9
}
]
},
"status": "ok"
}
IPO calendar
/ipo_calendar
The IPO Calendar endpoint provides detailed information on initial public offerings (IPOs), including those that have occurred in the past, are happening today, or are scheduled for the future. Users can access data such as company names, IPO dates, and offering details, allowing them to track and monitor IPO activity efficiently.

API credits cost

40 per request

This API endpoint is available starting with the Grow plan.
Parameters
Response
exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
Country where instrument is traded, e.g., United States or US

Example: United States

start_date

string
The earliest IPO date to include in the results. Format: 2006-01-02

Example: 2021-01-01

end_date

string
The latest IPO date to include in the results. Format: 2006-01-02

Example: 2021-12-31

Request example

https://api.twelvedata.com/ipo_calendar?apikey=demo
Response

{
"2025-07-16": [
{
"symbol": "DWACU",
"name": "Digital World Acquisition Corp.",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"price_range_low": 10,
"price_range_high": 10,
"offer_price": 0,
"currency": "USD",
"shares": 0
}
]
}
Statistics
High demand
/statistics
The statistics endpoint provides a comprehensive snapshot of a company's key financial statistics, including valuation metrics, revenue figures, profit margins, and other essential financial data. This endpoint is ideal for users seeking detailed insights into a company's financial health and performance metrics.

API credits cost

50 per symbol

This API endpoint is available starting with the Pro plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of instrument. For preffered stocks use dot(.) delimiter. E.g. BRK.A or BRK.B will be correct

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG000B9Y5X2

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
Country where instrument is traded, e.g., United States or US

Example: United States

Request example

https://api.twelvedata.com/statistics?symbol=AAPL&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"name": "Apple Inc",
"currency": "USD",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"exchange_timezone": "America/New_York"
},
"statistics": {
"valuations_metrics": {
"market_capitalization": 2546807865344,
"enterprise_value": 2620597731328,
"trailing_pe": 30.162493,
"forward_pe": 26.982489,
"peg_ratio": 1.4,
"price_to_sales_ttm": 7.336227,
"price_to_book_mrq": 39.68831,
"enterprise_to_revenue": 7.549,
"enterprise_to_ebitda": 23.623
},
"financials": {
"fiscal_year_ends": "2020-09-26",
"most_recent_quarter": "2021-06-26",
"gross_margin": 46.57807,
"profit_margin": 0.25004,
"operating_margin": 0.28788,
"return_on_assets_ttm": 0.19302,
"return_on_equity_ttm": 1.27125,
"income_statement": {
"revenue_ttm": 347155005440,
"revenue_per_share_ttm": 20.61,
"quarterly_revenue_growth": 0.364,
"gross_profit_ttm": 104956000000,
"ebitda": 110934999040,
"net_income_to_common_ttm": 86801997824,
"diluted_eps_ttm": 5.108,
"quarterly_earnings_growth_yoy": 0.932
},
"balance_sheet": {
"total_cash_mrq": 61696000000,
"total_cash_per_share_mrq": 3.732,
"total_debt_mrq": 135491002368,
"total_debt_to_equity_mrq": 210.782,
"current_ratio_mrq": 1.062,
"book_value_per_share_mrq": 3.882
},
"cash_flow": {
"operating_cash_flow_ttm": 104414003200,
"levered_free_cash_flow_ttm": 80625876992
}
},
"stock_statistics": {
"shares_outstanding": 16530199552,
"float_shares": 16513305231,
"avg_10_volume": 72804757,
"avg_90_volume": 77013078,
"shares_short": 93105968,
"short_ratio": 1.19,
"short_percent_of_shares_outstanding": 0.0056,
"percent_held_by_insiders": 0.00071000005,
"percent_held_by_institutions": 0.58474
},
"stock_price_summary": {
"fifty_two_week_low": 103.1,
"fifty_two_week_high": 157.26,
"fifty_two_week_change": 0.375625,
"beta": 1.201965,
"day_50_ma": 148.96686,
"day_200_ma": 134.42506
},
"dividends_and_splits": {
"forward_annual_dividend_rate": 0.88,
"forward_annual_dividend_yield": 0.0057,
"trailing_annual_dividend_rate": 0.835,
"trailing_annual_dividend_yield": 0.0053832764,
"5_year_average_dividend_yield": 1.27,
"payout_ratio": 0.16309999,
"dividend_frequency": "Quarterly",
"dividend_date": "2021-08-12",
"ex_dividend_date": "2021-08-06",
"last_split_factor": "4-for-1 split",
"last_split_date": "2020-08-31"
}
}
}
Income statement
High demand
/income_statement
The income statement endpoint provides detailed financial data on a company's income statement, including revenues, expenses, and net income for specified periods, either annually or quarterly. This endpoint is essential for retrieving comprehensive financial performance metrics of a company, allowing users to access historical and current financial results.

API credits cost

100 per symbol

This API endpoint is available starting with the Pro plan. Full access to historical data is available only in the Enterprise plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of instrument. For preffered stocks use dot(.) delimiter. E.g. BRK.A or BRK.B will be correct

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
Country where instrument is traded, e.g., United States or US

Example: United States

period

string
The reporting period for the income statement data

Supports: annual, quarterly

Example: annual

start_date

string
Begin date for filtering income statements by fiscal date. Returns income statements with fiscal dates on or after this date. Format 2006-01-02

Example: 2024-01-01

end_date

string
End date for filtering income statements by fiscal date. Returns income statements with fiscal dates on or before this date. Format 2006-01-02

Example: 2024-12-31

outputsize

integer
Number of records in response

Default: 6

Request example

https://api.twelvedata.com/income_statement?symbol=AAPL&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"name": "Apple Inc",
"currency": "USD",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"exchange_timezone": "America/New_York",
"period": "Quarterly"
},
"income_statement": [
{
"fiscal_date": "2021-12-31",
"quarter": 1,
"year": 2022,
"sales": 123945000000,
"cost_of_goods": 69702000000,
"gross_profit": 54243000000,
"operating_expense": {
"research_and_development": 6306000000,
"selling_general_and_administrative": 6449000000,
"other_operating_expenses": 0
},
"operating_income": 41488000000,
"non_operating_interest": {
"income": 650000000,
"expense": 694000000
},
"other_income_expense": -203000000,
"pretax_income": 41241000000,
"income_tax": 6611000000,
"net_income": 34630000000,
"eps_basic": 2.11,
"eps_diluted": 2.1,
"basic_shares_outstanding": 16391724000,
"diluted_shares_outstanding": 16391724000,
"ebit": 41488000000,
"ebitda": 44632000000,
"net_income_continuous_operations": 0,
"minority_interests": 0,
"preferred_stock_dividends": 0
}
]
}
Income statement consolidated
/income_statement/consolidated
The income statement consolidated endpoint provides a company's raw income statement, detailing revenue, expenses, and net income for specified periods, either annually or quarterly. This data is essential for evaluating a company's financial performance over time, allowing users to access comprehensive financial results in a structured format.

API credits cost

100 per symbol

This API endpoint is available starting with the Ultra plan. Full access to historical data is available only in the Enterprise plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of instrument. For preffered stocks use dot(.) delimiter. E.g. BRK.A or BRK.B will be correct

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
Country where instrument is traded, e.g., United States or US

Example: United States

period

string
The reporting period for the income statement data

Supports: annual, quarterly

start_date

string
Begin date for filtering income statements by fiscal date. Returns income statements with fiscal dates on or after this date. Format 2006-01-02

Example: 2024-01-01

end_date

string
End date for filtering income statements by fiscal date. Returns income statements with fiscal dates on or before this date. Format 2006-01-02

Example: 2024-12-31

outputsize

integer
Number of records in response

Default: 6

Request example

https://api.twelvedata.com/income_statement/consolidated?symbol=AAPL&apikey=demo
Response

{
"income_statement": [
{
"fiscal_date": "2023-09-30",
"year": 2022,
"revenue": {
"total_revenue": 383285000000,
"operating_revenue": 383285000000
},
"gross_profit": {
"gross_profit_value": 169148000000,
"cost_of_revenue": {
"cost_of_revenue_value": 214137000000,
"excise_taxes": 214137000000,
"reconciled_cost_of_revenue": 214137000000
}
},
"operating_income": {
"operating_income_value": 114301000000,
"total_operating_income_as_reported": 114301000000,
"operating_expense": 54847000000,
"other_operating_expenses": 114301000000,
"total_expenses": 268984000000
},
"net_income": {
"net_income_value": 96995000000,
"net_income_common_stockholders": 96995000000,
"net_income_including_noncontrolling_interests": 96995000000,
"net_income_from_tax_loss_carryforward": 96995000000,
"net_income_extraordinary": 96995000000,
"net_income_discontinuous_operations": 96995000000,
"net_income_continuous_operations": 96995000000,
"net_income_from_continuing_operation_net_minority_interest": 96995000000,
"net_income_from_continuing_and_discontinued_operation": 96995000000,
"normalized_income": 96995000000,
"minority_interests": 96995000000
},
"earnings_per_share": {
"diluted_eps": 6.13,
"basic_eps": 6.16,
"continuing_and_discontinued_diluted_eps": 6.16,
"continuing_and_discontinued_basic_eps": 6.16,
"normalized_diluted_eps": 6.16,
"normalized_basic_eps": 6.16,
"reported_normalized_diluted_eps": 6.16,
"reported_normalized_basic_eps": 6.16,
"diluted_eps_other_gains_losses": 6.16,
"tax_loss_carryforward_diluted_eps": 6.16,
"diluted_accounting_change": 6.16,
"diluted_extraordinary": 6.16,
"diluted_discontinuous_operations": 6.16,
"diluted_continuous_operations": 6.16,
"basic_eps_other_gains_losses": 6.16,
"tax_loss_carryforward_basic_eps": 6.16,
"basic_accounting_change": 6.16,
"basic_extraordinary": 6.16,
"basic_discontinuous_operations": 6.16,
"basic_continuous_operations": 6.16,
"diluted_ni_avail_to_common_stockholders": 96995000000,
"average_dilution_earnings": 96995000000
},
"expenses": {
"total_expenses": 268984000000,
"selling_general_and_administration_expense": 24932000000,
"selling_and_marketing_expense": 24932000000,
"general_and_administrative_expense": 24932000000,
"other_general_and_administrative_expense": 24932000000,
"depreciation_amortization_depletion_income_statement": 29915000000,
"research_and_development_expense": 29915000000,
"insurance_and_claims_expense": 29915000000,
"rent_and_landing_fees": 29915000000,
"salaries_and_wages_expense": 29915000000,
"rent_expense_supplemental": 29915000000,
"provision_for_doubtful_accounts": 29915000000
},
"interest_income_and_expense": {
"interest_income": 3750000000,
"interest_expense": 3933000000,
"net_interest_income": -183000000,
"net_non_operating_interest_income_expense": -183000000,
"interest_expense_non_operating": 3933000000,
"interest_income_non_operating": 3750000000
},
"other_income_and_expenses": {
"other_income_expense": -382000000,
"other_non_operating_income_expenses": -382000000,
"special_income_charges": 382000000,
"gain_on_sale_of_ppe": 382000000,
"gain_on_sale_of_business": 382000000,
"gain_on_sale_of_security": 382000000,
"other_special_charges": 382000000,
"write_off": 382000000,
"impairment_of_capital_assets": 382000000,
"restructuring_and_merger_acquisition": 382000000,
"securities_amortization": 382000000,
"earnings_from_equity_interest": 382000000,
"earnings_from_equity_interest_net_of_tax": 382000000,
"total_other_finance_cost": 382000000
},
"taxes": {
"tax_provision": 16741000000,
"tax_effect_of_unusual_items": 0,
"tax_rate_for_calculations": 0.147,
"other_taxes": 0
},
"depreciation_and_amortization": {
"depreciation_amortization_depletion": 129188000000,
"amortization_of_intangibles": 129188000000,
"depreciation": 129188000000,
"amortization": 129188000000,
"depletion": 129188000000,
"depreciation_and_amortization_in_income_statement": 129188000000
},
"ebitda": {
"ebitda_value": 129188000000,
"normalized_ebitda_value": 129188000000,
"ebit_value": 117669000000
},
"dividends_and_shares": {
"dividend_per_share": 15812547000,
"diluted_average_shares": 15812547000,
"basic_average_shares": 15744231000,
"preferred_stock_dividends": 15744231000,
"other_under_preferred_stock_dividend": 15744231000
},
"unusual_items": {
"total_unusual_items": 11519000000,
"total_unusual_items_excluding_goodwill": 11519000000
},
"depreciation": {
"reconciled_depreciation": 11519000000
},
"pretax_income": {
"pretax_income_value": 113736000000
},
"special_income_charges": {
"special_income_charges_value": 113736000000
}
}
],
"status": "ok"
}
Balance sheet
High demand
/balance_sheet
The balance sheet endpoint provides a detailed financial statement for a company, outlining its assets, liabilities, and shareholders' equity. This endpoint returns structured data that includes current and non-current assets, total liabilities, and equity figures, enabling users to assess a company's financial health and stability.

API credits cost

100 per symbol

This API endpoint is available starting with the Pro plan. Full access to historical data is available only in the Enterprise plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of instrument. For preffered stocks use dot(.) delimiter. E.g. BRK.A or BRK.B will be correct

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
Country where instrument is traded, e.g., United States or US

Example: United States

period

string
The reporting period for the balane sheet data

Supports: annual, quarterly

Default: annual

start_date

string
Begin date for filtering items by fiscal date. Returns income statements with fiscal dates on or after this date. Format 2006-01-02

Example: 2024-01-01

end_date

string
End date for filtering items by fiscal date. Returns income statements with fiscal dates on or before this date. Format 2006-01-02

Example: 2024-05-01

outputsize

integer
Number of records in response

Default: 6

Request example

https://api.twelvedata.com/balance_sheet?symbol=AAPL&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"name": "Apple Inc",
"currency": "USD",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"exchange_timezone": "America/New_York",
"period": "Quarterly"
},
"balance_sheet": [
{
"fiscal_date": "2021-09-30",
"year": 2022,
"assets": {
"current_assets": {
"cash": 17305000000,
"cash_equivalents": 17635000000,
"cash_and_cash_equivalents": 34940000000,
"other_short_term_investments": 27699000000,
"accounts_receivable": 26278000000,
"other_receivables": 25228000000,
"inventory": 6580000000,
"prepaid_assets": 0,
"restricted_cash": 0,
"assets_held_for_sale": 0,
"hedging_assets": 0,
"other_current_assets": 14111000000,
"total_current_assets": 134836000000
},
"non_current_assets": {
"properties": 0,
"land_and_improvements": 20041000000,
"machinery_furniture_equipment": 78659000000,
"construction_in_progress": 0,
"leases": 11023000000,
"accumulated_depreciation": -70283000000,
"goodwill": 0,
"investment_properties": 0,
"financial_assets": 0,
"intangible_assets": 0,
"investments_and_advances": 127877000000,
"other_non_current_assets": 48849000000,
"total_non_current_assets": 216166000000
},
"total_assets": 351002000000
},
"liabilities": {
"current_liabilities": {
"accounts_payable": 54763000000,
"accrued_expenses": 0,
"short_term_debt": 15613000000,
"deferred_revenue": 7612000000,
"tax_payable": 0,
"pensions": 0,
"other_current_liabilities": 47493000000,
"total_current_liabilities": 125481000000
},
"non_current_liabilities": {
"long_term_provisions": 0,
"long_term_debt": 109106000000,
"provision_for_risks_and_charges": 24689000000,
"deferred_liabilities": 0,
"derivative_product_liabilities": 0,
"other_non_current_liabilities": 28636000000,
"total_non_current_liabilities": 162431000000
},
"total_liabilities": 287912000000
},
"shareholders_equity": {
"common_stock": 57365000000,
"retained_earnings": 5562000000,
"other_shareholders_equity": 163000000,
"total_shareholders_equity": 63090000000,
"additional_paid_in_capital": 0,
"treasury_stock": 0,
"minority_interest": 0
}
}
]
}
Balance sheet consolidated
/balance_sheet/consolidated
The balance sheet consolidated endpoint provides a detailed overview of a company's raw balance sheet, including a comprehensive summary of its assets, liabilities, and shareholders' equity. This endpoint is useful for retrieving financial data that reflects the overall financial position of a company, allowing users to access critical information about its financial health and structure.

API credits cost

100 per symbol

This API endpoint is available starting with the Ultra plan. Full access to historical data is available only in the Enterprise plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of instrument. For preffered stocks use dot(.) delimiter. E.g. BRK.A or BRK.B will be correct

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
Country where instrument is traded, e.g., United States or US

Example: United States

period

string
The reporting period for the balance sheet data.

Supports: annual, quarterly

Default: annual

start_date

string
Begin date for filtering items by fiscal date. Returns income statements with fiscal dates on or after this date. Format 2006-01-02

end_date

string
End date for filtering items by fiscal date. Returns income statements with fiscal dates on or before this date. Format 2006-01-02

outputsize

integer
Number of records in response

Default: 6

Request example

https://api.twelvedata.com/balance_sheet/consolidated?symbol=AAPL&apikey=demo
Response

{
"balance_sheet": [
{
"fiscal_date": "2023-09-30",
"assets": {
"total_assets": 352583000000,
"current_assets": {
"total_current_assets": 143566000000,
"cash_cash_equivalents_and_short_term_investments": 61555000000,
"cash_and_cash_equivalents": 29965000000,
"cash_equivalents": 1606000000,
"cash_financial": 28359000000,
"other_short_term_investments": 31590000000,
"restricted_cash": 31590000000,
"receivables": {
"total_receivables": 60985000000,
"accounts_receivable": 29508000000,
"gross_accounts_receivable": 29508000000,
"allowance_for_doubtful_accounts_receivable": 29508000000,
"receivables_adjustments_allowances": 29508000000,
"other_receivables": 31477000000,
"due_from_related_parties_current": 31477000000,
"taxes_receivable": 31477000000,
"accrued_interest_receivable": 31477000000,
"notes_receivable": 31477000000,
"loans_receivable": 31477000000
},
"inventory": {
"total_inventory": 6331000000,
"inventories_adjustments_allowances": 6331000000,
"other_inventories": 6331000000,
"finished_goods": 6331000000,
"work_in_process": 6331000000,
"raw_materials": 6331000000
},
"prepaid_assets": 14695000000,
"current_deferred_assets": 14695000000,
"current_deferred_taxes_assets": 14695000000,
"assets_held_for_sale_current": 14695000000,
"hedging_assets_current": 14695000000,
"other_current_assets": 14695000000
},
"non_current_assets": {
"total_non_current_assets": 209017000000,
"financial_assets": 209017000000,
"investments_and_advances": 100544000000,
"other_investments": 100544000000,
"investment_in_financial_assets": 100544000000,
"held_to_maturity_securities": 100544000000,
"available_for_sale_securities": 100544000000,
"financial_assets_designated_as_fair_value_through_profit_or_loss_total": 100544000000,
"trading_securities": 100544000000,
"long_term_equity_investment": 100544000000,
"investments_in_joint_ventures_at_cost": 100544000000,
"investments_in_other_ventures_under_equity_method": 100544000000,
"investments_in_associates_at_cost": 100544000000,
"investments_in_subsidiaries_at_cost": 100544000000,
"investment_properties": 100544000000,
"goodwill_and_other_intangible_assets": {
"goodwill": 100544000000,
"other_intangible_assets": 100544000000,
"total_goodwill_and_intangible_assets": 100544000000
},
"net_ppe": 54376000000,
"gross_ppe": 125260000000,
"accumulated_depreciation": -70884000000,
"leases": 12839000000,
"construction_in_progress": 12839000000,
"other_properties": 10661000000,
"machinery_furniture_equipment": 78314000000,
"buildings_and_improvements": 12839000000,
"land_and_improvements": 23446000000,
"properties": 0,
"non_current_accounts_receivable": 12839000000,
"non_current_note_receivables": 12839000000,
"due_from_related_parties_non_current": 12839000000,
"non_current_prepaid_assets": 12839000000,
"non_current_deferred_assets": 17852000000,
"non_current_deferred_taxes_assets": 17852000000,
"defined_pension_benefit": 12839000000,
"other_non_current_assets": 36245000000
},
"liabilities": {
"total_liabilities_net_minority_interest": 290437000000,
"current_liabilities": {
"total_current_liabilities": 145308000000,
"current_debt_and_capital_lease_obligation": 17382000000,
"current_debt": 15807000000,
"current_capital_lease_obligation": 1575000000,
"other_current_borrowings": 9822000000,
"line_of_credit": 9822000000,
"commercial_paper": 5985000000,
"current_notes_payable": 9822000000,
"current_provisions": 9822000000,
"payables_and_accrued_expenses": {
"total_payables_and_accrued_expenses": 71430000000,
"accounts_payable": 62611000000,
"current_accrued_expenses": 9822000000,
"interest_payable": 9822000000,
"payables": 71430000000,
"other_payable": 9822000000,
"due_to_related_parties_current": 9822000000,
"dividends_payable": 9822000000,
"total_tax_payable": 8819000000,
"income_tax_payable": 8819000000
},
"pension_and_other_post_retirement_benefit_plans_current": 8061000000,
"employee_benefits": 8061000000,
"current_deferred_liabilities": 8061000000,
"current_deferred_revenue": 8061000000,
"current_deferred_taxes_liabilities": 8061000000,
"other_current_liabilities": 48435000000,
"liabilities_held_for_sale_non_current": 48435000000
},
"non_current_liabilities": {
"total_non_current_liabilities_net_minority_interest": 145129000000,
"long_term_debt_and_capital_lease_obligation": {
"total_long_term_debt_and_capital_lease_obligation": 106548000000,
"long_term_debt": 95281000000,
"long_term_capital_lease_obligation": 11267000000
},
"long_term_provisions": 15457000000,
"non_current_pension_and_other_postretirement_benefit_plans": 15457000000,
"non_current_accrued_expenses": 15457000000,
"due_to_related_parties_non_current": 15457000000,
"trade_and_other_payables_non_current": 15457000000,
"non_current_deferred_liabilities": 15457000000,
"non_current_deferred_revenue": 15457000000,
"non_current_deferred_taxes_liabilities": 15457000000,
"other_non_current_liabilities": 23124000000,
"preferred_securities_outside_stock_equity": 15457000000,
"derivative_product_liabilities": 15457000000,
"capital_lease_obligations": 12842000000,
"restricted_common_stock": 12842000000
},
"equity": {
"total_equity_gross_minority_interest": 62146000000,
"stockholders_equity": 62146000000,
"common_stock_equity": 62146000000,
"preferred_stock_equity": 62146000000,
"other_equity_interest": 62146000000,
"minority_interest": 62146000000,
"total_capitalization": 157427000000,
"net_tangible_assets": 62146000000,
"tangible_book_value": 62146000000,
"invested_capital": 173234000000,
"working_capital": -1742000000,
"capital_stock": {
"common_stock": 73812000000,
"preferred_stock": 73812000000,
"total_partnership_capital": 73812000000,
"general_partnership_capital": 73812000000,
"limited_partnership_capital": 73812000000,
"capital_stock": 73812000000,
"other_capital_stock": 73812000000,
"additional_paid_in_capital": 73812000000,
"retained_earnings": -214000000,
"treasury_stock": 73812000000,
"treasury_shares_number": 0,
"ordinary_shares_number": 15550061000,
"preferred_shares_number": 73812000000,
"share_issued": 15550061000
},
"equity_adjustments": {
"gains_losses_not_affecting_retained_earnings": -11452000000,
"other_equity_adjustments": -11452000000,
"fixed_assets_revaluation_reserve": 11452000000,
"foreign_currency_translation_adjustments": 11452000000,
"minimum_pension_liabilities": 11452000000,
"unrealized_gain_loss": 11452000000
},
"net_debt": 81123000000,
"total_debt": 123930000000
}
}
}
}
],
"status": "ok"
}
Cash flow
High demand
/cash_flow
The cash flow endpoint provides detailed information on a company's cash flow activities, including the net cash and cash equivalents moving in and out of the business. This data includes operating, investing, and financing cash flows, offering a comprehensive view of the company's liquidity and financial health.

API credits cost

100 per symbol

This API endpoint is available starting with the Pro plan. Full access to historical data is available only in the Enterprise plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of instrument. For preffered stocks use dot(.) delimiter. E.g. BRK.A or BRK.B will be correct

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
Country where instrument is traded, e.g., United States or US

Example: United States

period

string
The reporting period for the cash flow statements

Supports: annual, quarterly

Default: annual

start_date

string
Start date for filtering cash flow statements. Only cash flow statements with fiscal dates on or after this date will be included. Format 2006-01-02

Example: 2024-01-01

end_date

string
End date for filtering cash flow statements. Only cash flow statements with fiscal dates on or before this date will be included. Format 2006-01-02

Example: 2024-12-31

outputsize

integer
Number of records in response

Default: 6

Request example

https://api.twelvedata.com/cash_flow?symbol=AAPL&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"name": "Apple Inc",
"currency": "USD",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"exchange_timezone": "America/New_York",
"period": "Quarterly"
},
"cash_flow": [
{
"fiscal_date": "2021-12-31",
"quarter": "1",
"year": 2022,
"operating_activities": {
"net_income": 34630000000,
"depreciation": 2697000000,
"deferred_taxes": 682000000,
"stock_based_compensation": 2265000000,
"other_non_cash_items": 167000000,
"accounts_receivable": -13746000000,
"accounts_payable": 19813000000,
"other_assets_liabilities": 458000000,
"operating_cash_flow": 46966000000
},
"investing_activities": {
"capital_expenditures": -2803000000,
"net_intangibles": 0,
"net_acquisitions": 0,
"purchase_of_investments": -34913000000,
"sale_of_investments": 21984000000,
"other_investing_activity": -374000000,
"investing_cash_flow": -16106000000
},
"financing_activities": {
"long_term_debt_issuance": 0,
"long_term_debt_payments": 0,
"short_term_debt_issuance": -1000000000,
"common_stock_issuance": 0,
"common_stock_repurchase": -20478000000,
"common_dividends": -3732000000,
"other_financing_charges": -2949000000,
"financing_cash_flow": -28159000000
},
"end_cash_position": 38630000000,
"income_tax_paid": 5235000000,
"interest_paid": 531000000,
"free_cash_flow": 49769000000
}
]
}
Cash flow consolidated
/cash_flow/consolidated
The cash flow consolidated endpoint provides raw data on a company's consolidated cash flow, including the net cash and cash equivalents moving in and out of the business. It returns information on operating, investing, and financing activities, helping users track liquidity and financial health over a specified period.

API credits cost

100 per symbol

This API endpoint is available starting with the Ultra plan. Full access to historical data is available only in the Enterprise plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of instrument. For preffered stocks use dot(.) delimiter. E.g. BRK.A or BRK.B will be correct

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
Country where instrument is traded, e.g., United States or US

Example: United States

period

string
The reporting period for the cash flow statements

Supports: annual, quarterly

Default: annual

start_date

string
Start date for filtering cash flow statements. Only cash flow statements with fiscal dates on or after this date will be included. Format 2006-01-02

Example: 2024-01-01

end_date

string
End date for filtering cash flow statements. Only cash flow statements with fiscal dates on or before this date will be included. Format 2006-01-02

Example: 2024-12-31

outputsize

integer
Number of records in response

Default: 6

Request example

https://api.twelvedata.com/cash_flow/consolidated?symbol=AAPL&apikey=demo
Response

{
"cash_flow": [
{
"fiscal_date": "2023-09-30",
"year": 2024,
"cash_flow_from_operating_activities": {
"net_income_from_continuing_operations": 96995000000,
"operating_cash_flow": 110543000000,
"cash_flow_from_continuing_operating_activities": 110543000000,
"cash_from_discontinued_operating_activities": 108488000000,
"cash_flow_from_discontinued_operation": 108488000000,
"free_cash_flow": 99584000000,
"cash_flows_from_used_in_operating_activities_direct": 108488000000,
"taxes_refund_paid": 108488000000,
"taxes_refund_paid_direct": 108488000000,
"interest_received": 108488000000,
"interest_received_direct": 108488000000,
"interest_paid": 108488000000,
"interest_paid_direct": 108488000000,
"dividend_received": 108488000000,
"dividend_received_direct": 108488000000,
"dividend_paid": 108488000000,
"dividend_paid_direct": 108488000000,
"change_in_working_capital": -6577000000,
"change_in_other_working_capital": 108488000000,
"change_in_receivables": -417000000,
"changes_in_account_receivables": -1688000000,
"change_in_payables_and_accrued_expense": -1889000000,
"change_in_accrued_expense": 108488000000,
"change_in_payable": -1889000000,
"change_in_dividend_payable": 108488000000,
"change_in_account_payable": -1889000000,
"change_in_tax_payable": 108488000000,
"change_in_income_tax_payable": 108488000000,
"change_in_interest_payable": 108488000000,
"change_in_other_current_liabilities": 3031000000,
"change_in_other_current_assets": -5684000000,
"change_in_inventory": -1618000000,
"change_in_prepaid_assets": 108488000000,
"other_non_cash_items": -2227000000,
"excess_tax_benefit_from_stock_based_compensation": 108488000000,
"stock_based_compensation": 10833000000,
"unrealized_gain_loss_on_investment_securities": 108488000000,
"provision_and_write_off_of_assets": 108488000000,
"asset_impairment_charge": 108488000000,
"amortization_of_securities": 108488000000,
"deferred_tax": 108488000000,
"deferred_income_tax": 108488000000,
"depreciation_amortization_depletion": 11519000000,
"depletion": 108488000000,
"depreciation_and_amortization": 11519000000,
"amortization_cash_flow": 108488000000,
"amortization_of_intangibles": 108488000000,
"depreciation": 108488000000,
"operating_gains_losses": 108488000000,
"pension_and_employee_benefit_expense": 108488000000,
"earnings_losses_from_equity_investments": 108488000000,
"gain_loss_on_investment_securities": 108488000000,
"net_foreign_currency_exchange_gain_loss": 108488000000,
"gain_loss_on_sale_of_ppe": 108488000000,
"gain_loss_on_sale_of_business": 108488000000
},
"cash_flow_from_investing_activities": {
"investing_cash_flow": 3705000000,
"cash_flow_from_continuing_investing_activities": 3705000000,
"cash_from_discontinued_investing_activities": 108488000000,
"net_other_investing_changes": -1337000000,
"interest_received_cfi": 108488000000,
"dividends_received_cfi": 108488000000,
"net_investment_purchase_and_sale": 16001000000,
"sale_of_investment": 45514000000,
"purchase_of_investment": -29513000000,
"net_investment_properties_purchase_and_sale": 108488000000,
"sale_of_investment_properties": 108488000000,
"purchase_of_investment_properties": 108488000000,
"net_business_purchase_and_sale": 108488000000,
"sale_of_business": 108488000000,
"purchase_of_business": 108488000000,
"net_intangibles_purchase_and_sale": 108488000000,
"sale_of_intangibles": 108488000000,
"purchase_of_intangibles": 108488000000,
"net_ppe_purchase_and_sale": -10959000000,
"sale_of_ppe": 108488000000,
"purchase_of_ppe": -10959000000,
"capital_expenditure_reported": 108488000000,
"capital_expenditure": -10959000000
},
"cash_flow_from_financing_activities": {
"financing_cash_flow": -108488000000,
"cash_flow_from_continuing_financing_activities": -108488000000,
"cash_from_discontinued_financing_activities": 108488000000,
"net_other_financing_charges": -6012000000,
"interest_paid_cff": 108488000000,
"proceeds_from_stock_option_exercised": 108488000000,
"cash_dividends_paid": -15025000000,
"preferred_stock_dividend_paid": 108488000000,
"common_stock_dividend_paid": -15025000000,
"net_preferred_stock_issuance": 108488000000,
"preferred_stock_payments": 108488000000,
"preferred_stock_issuance": 108488000000,
"net_common_stock_issuance": -77550000000,
"common_stock_payments": -77550000000,
"common_stock_issuance": 108488000000,
"repurchase_of_capital_stock": -77550000000,
"net_issuance_payments_of_debt": -9901000000,
"net_short_term_debt_issuance": -3978000000,
"short_term_debt_payments": 108488000000,
"short_term_debt_issuance": 108488000000,
"net_long_term_debt_issuance": -5923000000,
"long_term_debt_payments": -11151000000,
"long_term_debt_issuance": 5228000000,
"issuance_of_debt": 5228000000,
"repayment_of_debt": -11151000000,
"issuance_of_capital_stock": 108488000000
},
"supplemental_data": {
"interest_paid_supplemental_data": 3803000000,
"income_tax_paid_supplemental_data": 18679000000
},
"foreign_and_domestic_sales": {
"foreign_sales": 108488000000,
"domestic_sales": 108488000000,
"adjusted_geography_segment_data": 108488000000
},
"cash_position": {
"beginning_cash_position": 24977000000,
"end_cash_position": 30737000000,
"changes_in_cash": 5760000000,
"other_cash_adjustment_outside_change_in_cash": 108488000000,
"other_cash_adjustment_inside_change_in_cash": 108488000000,
"effect_of_exchange_rate_changes": 108488000000
},
"direct_method_cash_flow": {
"classes_of_cash_receipts_from_operating_activities": 108488000000,
"other_cash_receipts_from_operating_activities": 108488000000,
"receipts_from_government_grants": 108488000000,
"receipts_from_customers": 108488000000,
"classes_of_cash_payments": 108488000000,
"other_cash_payments_from_operating_activities": 108488000000,
"payments_on_behalf_of_employees": 108488000000,
"payments_to_suppliers_for_goods_and_services": 108488000000
}
}
],
"status": "ok"
}
Key executives
Useful
/key_executives
The key executives endpoint provides detailed information about a company's key executives identified by a specific stock symbol. It returns data such as names, titles, and roles of the executives, which can be useful for understanding the leadership structure of the company.

API credits cost

1000 per symbol

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of instrument. For preffered stocks use dot(.) delimiter. E.g. BRK.A or BRK.B will be correct

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
Country where instrument is traded, e.g., United States or US

Example: United States

Request example

https://api.twelvedata.com/key_executives?symbol=AAPL&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"name": "Apple Inc",
"currency": "USD",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"exchange_timezone": "America/New_York"
},
"key_executives": [
{
"name": "Mr. Timothy D. Cook",
"title": "CEO & Director",
"age": 59,
"year_born": 1961,
"pay": 14769259
}
]
}
Market capitalization
New
/market_cap
The Market Capitalization History endpoint provides historical data on a company's market capitalization over a specified time period. It returns a time series of market cap values, allowing users to track changes in a company's market value.

API credits cost

5 per request

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
Filter by symbol

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

exchange

string
Filter by exchange name

Example: NASDAQ

mic_code

string
Filter by market identifier code (MIC) under ISO 10383 standard

Example: XNAS

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

start_date

string
Start date for market capitalization data retrieval. Data will be returned from this date onwards. Format 2006-01-02

Example: 2023-01-01

end_date

string
End date for market capitalization data retrieval. Data will be returned up to and including this date. Format 2006-01-02

Example: 2023-12-31

page

integer
Page number

Default: 1

outputsize

integer
Number of records in response

Default: 10

Request example

https://api.twelvedata.com/market_cap?symbol=AAPL&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"name": "Apple Inc",
"currency": "USD",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"exchange_timezone": "America/New_York"
},
"market_cap": [
{
"date": "2025-07-14",
"value": 3115906555944
},
{
"date": "2025-07-11",
"value": 3153843487457
},
{
"date": "2025-07-10",
"value": 3172513237217
}
]
}
Last changes
New
/last_change/{endpoint}
The last change endpoint provides the most recent updates to fundamental data for a specified dataset. It returns a timestamp indicating when the data was last modified, allowing users to efficiently manage API requests by only fetching new data when changes occur. This helps optimize data retrieval and reduce unnecessary API credit usage.

API credits cost

1 per request

Parameters
Response
endpoint

string
Endpoint name

Supports: price_target, recommendations, statistics, insider_transactions, profile, mutual_funds_world_summary, mutual_funds_world, institutional_holders, analyst_rating, income_statement, income_statement_quarterly, cash_flow, cash_flow_quarterly, balance_sheet, balance_sheet_quarterly, mutual_funds_list, mutual_funds_world_sustainability, mutual_funds_world_summary, mutual_funds_world_risk, mutual_funds_world_purchase_info, mutual_funds_world_composition, mutual_funds_world_performance, mutual_funds_world, etfs_list, etfs_world, etfs_world_summary, etfs_world_performance, etfs_world_risk, etfs_world_composition, dividends, splits

Example: statistics

start_date

string
The starting date and time for data selection, in 2006-01-02T15:04:05 format

Example: 2023-10-14T00:00:00

symbol

string
Filter by symbol

Example: AAPL

exchange

string
Filter by exchange name

Example: NASDAQ

mic_code

string
Filter by market identifier code (MIC) under ISO 10383 standard

Example: XNAS

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

page

integer
Page number

Default: 1

outputsize

integer
Number of records in response

Default: 30

Request example

https://api.twelvedata.com/last_change/statistics?apikey=demo
Response

{
"pagination": {
"current_page": 1,
"per_page": 30
},
"data": [
{
"symbol": "AAPL",
"mic_code": "XNAS",
"last_change": "2023-10-14 12:22:48"
}
]
}
Currencies
Exchange rate
/exchange_rate
The exchange rate endpoint provides real-time exchange rates for specified currency pairs, including both forex and cryptocurrency. It returns the current exchange rate value between two currencies, allowing users to quickly access up-to-date conversion rates for financial transactions or market analysis.

API credits cost

1 per symbol

Parameters
Response
symbol

string
The currency pair you want to request can be either forex or cryptocurrency. Slash(/) delimiter is used. E.g. EUR/USD or BTC/ETH will be correct

Example: EUR/USD

date

string
If not null, will use exchange rate from a specific date or time. Format 2006-01-02 or 2006-01-02T15:04:05. Is set in the local exchange time zone, use timezone parameter to specify a specific time zone

Example: 2006-01-02T15:04:05

format

string
Value can be JSON or CSV. Default JSON

Supports: JSON, CSV

Default: JSON

delimiter

string
Specify the delimiter used when downloading the CSV file. Default semicolon ;

Default: ;

dp

integer
The number of decimal places for the data

Default: 5

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here.
   Take note that the IANA Timezone name is case-sensitive
   Example: UTC

Request example

https://api.twelvedata.com/exchange_rate?symbol=EUR/USD&apikey=demo
Response

{
"symbol": "USD/JPY",
"rate": 105.12,
"timestamp": 1602714051
}
Currency conversion
Useful
/currency_conversion
The currency conversion endpoint provides real-time exchange rates and calculates the converted amount for specified currency pairs, including both forex and cryptocurrencies. This endpoint is useful for obtaining up-to-date conversion values between two currencies, facilitating tasks such as financial reporting, e-commerce transactions, and travel budgeting.

API credits cost

1 per symbol

Parameters
Response
symbol

string
The currency pair you want to request can be either forex or cryptocurrency. Slash(/) delimiter is used. E.g. EUR/USD or BTC/ETH will be correct

Example: EUR/USD

amount

double
Amount of base currency to be converted into quote currency. Supports values in the range from 0 and above

Example: 100

date

string
If not null, will use exchange rate from a specific date or time. Format 2006-01-02 or 2006-01-02T15:04:05. Is set in the local exchange time zone, use timezone parameter to specify a specific time zone

Example: 2006-01-02T15:04:05

format

string
Value can be JSON or CSV. Default JSON

Supports: JSON, CSV

Default: JSON

delimiter

string
Specify the delimiter used when downloading the CSV file. Default semicolon ;

Default: ;

dp

integer
The number of decimal places for the data

Default: 5

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here.
   Take note that the IANA Timezone name is case-sensitive
   Example: UTC

Request example

https://api.twelvedata.com/currency_conversion?symbol=EUR/USD&amount=100&apikey=demo
Response

{
"symbol": "USD/JPY",
"rate": 105.12,
"amount": 12824.64,
"timestamp": 1602714051
}
ETFs
ETF-focused metadata and analytics: universe lists, family and type groupings, NAV snapshots, performance metrics, risk measures, and current fund composition. Tailored to the unique characteristics and reporting cadence of exchange-traded funds.

ETFs directory
Useful
/etfs/list
The ETFs directory endpoint provides a daily updated list of exchange-traded funds, sorted by total assets in descending order. This endpoint is useful for retrieving comprehensive ETF data, including fund names and asset values, to assist users in quickly identifying the ETFs available.

API credits cost

1 per request

With Basic, Grow, and Pro plans, only 50 records will be in response. Ultra, Enterprise and Custom plans can access complete data on over 46,000 ETFs.
Parameters
Response
symbol

string
Filter by symbol

Example: IVV

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG000BVZ697

isin

string
Filter by international securities identification number (ISIN)

Example: US4642872000

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 464287200

cik

string
The CIK of an instrument for which data is requested

Example: 95953

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

fund_family

string
Filter by investment company that manages the fund

Example: iShares

fund_type

string
Filter by the type of fund

Example: Large Blend

page

integer
Page number

Default: 1

outputsize

integer
Number of records in response

Default: 50

Request example

https://api.twelvedata.com/etfs/list?apikey=demo
Response

{
"result": {
"count": 1000,
"list": [
{
"symbol": "IVV",
"name": "iShares Core S&P 500 ETF",
"country": "United States",
"mic_code": "XNAS",
"fund_family": "iShares",
"fund_type": "Large Blend"
}
]
},
"status": "ok"
}
ETF full data
High demand
/etfs/world
The ETF full data endpoint provides detailed information about global Exchange-Traded Funds. It returns comprehensive data, including a summary, performance metrics, risk assessment, and composition details. This endpoint is ideal for users seeking an in-depth analysis of worldwide ETFs, enabling them to access key financial metrics and portfolio breakdowns.

API credits cost

800 per request

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of etf

Example: IVV

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG000BVZ697

isin

string
Filter by international securities identification number (ISIN)

Example: US4642872000

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 464287200

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

dp

integer
Number of decimal places for floating values. Accepts value in range [0,11]

Default: 5

Request example

https://api.twelvedata.com/etfs/world?symbol=IVV&apikey=demo
Response

{
"etf": {
"summary": {
"symbol": "IVV",
"name": "iShares Core S&P 500 ETF",
"fund_family": "iShares",
"fund_type": "Large Blend",
"currency": "USD",
"share_class_inception_date": "2000-11-13",
"ytd_return": -0.0537,
"expense_ratio_net": -0.004,
"yield": 0.0133,
"nav": 413.24,
"last_price": 413.24,
"turnover_rate": 0.04,
"net_assets": 753409982464,
"overview": "The investment seeks to track the performance of the Standard & Poor's 500..."
},
"performance": {
"trailing_returns": [
{
"period": "ytd",
"share_class_return": -0.0751,
"category_return": 0.1484
}
],
"annual_total_returns": [
{
"year": 2021,
"share_class_return": 0.2866,
"category_return": 0
}
]
},
"risk": {
"volatility_measures": [
{
"period": "3_year",
"alpha": -0.03,
"alpha_category": -0.02,
"beta": 1,
"beta_category": 0.01,
"mean_annual_return": 1.58,
"mean_annual_return_category": 0.01,
"r_squared": 100,
"r_squared_category": 0.95,
"std": 18.52,
"std_category": 0.19,
"sharpe_ratio": 0.95,
"sharpe_ratio_category": 0.01,
"treynor_ratio": 17.41,
"treynor_ratio_category": 0.16
}
],
"valuation_metrics": {
"price_to_earnings": 26.46,
"price_to_book": 4.42,
"price_to_sales": 2.96,
"price_to_cashflow": 17.57
}
},
"composition": {
"major_market_sectors": [
{
"sector": "Technology",
"weight": 0.2424
}
],
"country_allocation": [
{
"country": "United Kingdom",
"allocation": 0.9855
}
],
"asset_allocation": {
"cash": 0.0004,
"stocks": 0.9996,
"preferred_stocks": 0,
"convertables": 0,
"bonds": 0,
"others": 0
},
"top_holdings": [
{
"symbol": "AAPL",
"name": "Apple Inc",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"weight": 0.0592
}
],
"bond_breakdown": {
"average_maturity": {
"fund": 6.65,
"category": 7.81
},
"average_duration": {
"fund": 5.72,
"category": 5.64
},
"credit_quality": [
{
"grade": "AAA",
"weight": 0
}
]
}
}
},
"status": "ok"
}
Summary
/etfs/world/summary
The ETFs summary endpoint provides a concise overview of global Exchange-Traded Funds. It returns key data points such as ETF names, symbols, and current market values, enabling users to quickly assess the performance and status of various international ETFs. This summary is ideal for users who need a snapshot of the global ETF landscape without delving into detailed analysis.

API credits cost

200 per request

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of etf

Example: IVV

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG000BVZ697

isin

string
Filter by international securities identification number (ISIN)

Example: US4642872000

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 464287200

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

dp

integer
Number of decimal places for floating values. Accepts value in range [0,11]

Default: 5

Request example

https://api.twelvedata.com/etfs/world/summary?symbol=IVV&apikey=demo
Response

{
"etf": {
"summary": {
"symbol": "IVV",
"name": "iShares Core S&P 500 ETF",
"fund_family": "iShares",
"fund_type": "Large Blend",
"currency": "USD",
"share_class_inception_date": "2000-11-13",
"ytd_return": -0.0537,
"expense_ratio_net": -0.004,
"yield": 0.0133,
"nav": 413.24,
"last_price": 413.24,
"turnover_rate": 0.04,
"net_assets": 753409982464,
"overview": "The investment seeks to track the performance of the Standard & Poor's 500..."
}
},
"status": "ok"
}
Performance
High demand
/etfs/world/performance
The ETFs performance endpoint provides comprehensive performance data for exchange-traded funds globally. It returns detailed metrics such as trailing returns and annual returns, enabling users to evaluate the historical performance of various ETFs. This endpoint is ideal for users looking to compare ETF performance over different time periods and assess their investment potential.

API credits cost

200 per request

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of etf

Example: IVV

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG000BVZ697

isin

string
Filter by international securities identification number (ISIN)

Example: US4642872000

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 464287200

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

dp

integer
Number of decimal places for floating values. Accepts value in range [0,11]

Default: 5

Request example

https://api.twelvedata.com/etfs/world/performance?symbol=IVV&apikey=demo
Response

{
"etf": {
"performance": {
"trailing_returns": [
{
"period": "ytd",
"share_class_return": -0.0751,
"category_return": 0.1484
}
],
"annual_total_returns": [
{
"year": 2021,
"share_class_return": 0.2866,
"category_return": 0
}
]
}
},
"status": "ok"
}
Risk
/etfs/world/risk
The ETFs risk endpoint provides essential risk metrics for global Exchange Traded Funds. It returns data such as volatility, beta, and other risk-related indicators, enabling users to assess the potential risk associated with investing in various ETFs worldwide.

API credits cost

200 per request

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of etf

Example: IVV

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG000BVZ697

isin

string
Filter by international securities identification number (ISIN)

Example: US4642872000

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 464287200

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

dp

integer
Number of decimal places for floating values. Accepts value in range [0,11]

Default: 5

Request example

https://api.twelvedata.com/etfs/world/risk?symbol=IVV&apikey=demo
Response

{
"etf": {
"risk": {
"volatility_measures": [
{
"period": "3_year",
"alpha": -0.03,
"alpha_category": -0.02,
"beta": 1,
"beta_category": 0.01,
"mean_annual_return": 1.58,
"mean_annual_return_category": 0.01,
"r_squared": 100,
"r_squared_category": 0.95,
"std": 18.52,
"std_category": 0.19,
"sharpe_ratio": 0.95,
"sharpe_ratio_category": 0.01,
"treynor_ratio": 17.41,
"treynor_ratio_category": 0.16
}
],
"valuation_metrics": {
"price_to_earnings": 26.46,
"price_to_book": 4.42,
"price_to_sales": 2.96,
"price_to_cashflow": 17.57
}
}
},
"status": "ok"
}
Composition
High demand
/etfs/world/composition
The ETFs composition endpoint provides detailed information about the composition of global Exchange-Traded Funds. It returns data on the sectors included in the ETF, specific holding details, and the weighted exposure of each component. This endpoint is useful for users who need to understand the specific makeup and sector distribution of an ETF portfolio.

API credits cost

200 per request

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of etf

Example: IVV

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG000BVZ697

isin

string
Filter by international securities identification number (ISIN)

Example: US4642872000

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 464287200

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

dp

integer
Number of decimal places for floating values. Accepts value in range [0,11]

Default: 5

Request example

https://api.twelvedata.com/etfs/world/composition?symbol=IVV&apikey=demo
Response

{
"etf": {
"composition": {
"major_market_sectors": [
{
"sector": "Technology",
"weight": 0.2424
}
],
"country_allocation": [
{
"country": "United Kingdom",
"allocation": 0.9855
}
],
"asset_allocation": {
"cash": 0.0004,
"stocks": 0.9996,
"preferred_stocks": 0,
"convertables": 0,
"bonds": 0,
"others": 0
},
"top_holdings": [
{
"symbol": "AAPL",
"name": "Apple Inc",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"weight": 0.0592
}
],
"bond_breakdown": {
"average_maturity": {
"fund": 6.65,
"category": 7.81
},
"average_duration": {
"fund": 5.72,
"category": 5.64
},
"credit_quality": [
{
"grade": "AAA",
"weight": 0
}
]
}
}
},
"status": "ok"
}
ETFs families
/etfs/family
Retrieve a comprehensive list of exchange-traded fund (ETF) families, providing users with detailed information on various ETF groups available in the market. This endpoint is ideal for users looking to explore different ETF categories, compare offerings, or integrate ETF family data into their financial applications.

API credits cost

1 per request

Parameters
Response
country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

fund_family

string
Filter by investment company that manages the fund

Example: iShares

Request example

https://api.twelvedata.com/etfs/family?apikey=demo
Response

{
"result": {
"India": [
"Aberdeen Standard Fund Managers Limited",
"Aditya Birla Sun Life AMC Ltd"
],
"United States": [
"Aegon Asset Management UK PLC",
"Ampega Investment GmbH",
"Aviva SpA"
]
},
"status": "ok"
}
ETFs types
/etfs/type
The ETFs Types endpoint provides a concise list of ETF categories by market (e.g., Singapore, United States), including types like "Equity Precious Metals" and "Large Blend." It supports targeted investment research and portfolio diversification.

API credits cost

1 per request

Parameters
Response
country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

fund_type

string
Filter by the type of fund

Example: Large Blend

Request example

https://api.twelvedata.com/etfs/type?apikey=demo
Response

{
"result": {
"Singapore": [
"Property - Indirect Asia",
"Sector Equity Water"
],
"United States": [
"Asia-Pacific ex-Japan Equity",
"EUR Flexible Allocation - Global"
]
},
"status": "ok"
}
Mutual funds
Mutual-fund-specific listings and snapshots: fund directories, issuer families, fund types, NAV history, dividend records, key ratios, and portfolio holdings. Ideal for long-term performance analysis and portfolio attribution.

MFs directory
Useful
/mutual_funds/list
The mutual funds directory endpoint provides a daily updated list of mutual funds, sorted in descending order by their total assets value. This endpoint is useful for retrieving an organized overview of available mutual funds.

API credits cost

1 per request

With Basic, Grow, and Pro plans, only 50 records will be in response. Ultra, Enterprise and Custom plans can access complete data on over 140,000 Mutual Funds.
Parameters
Response
symbol

string
Filter by symbol

Example: 1535462D

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG00HMMLCH1

isin

string
Filter by international securities identification number (ISIN)

Example: LU1206782309

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 120678230

cik

string
The CIK of an instrument for which data is requested

Example: 95953

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

fund_family

string
Filter by investment company that manages the fund

Example: Jackson National

fund_type

string
Filter by the type of fund

Example: Small Blend

performance_rating

integer
Filter by performance rating from 0 to 5

Example: 4

risk_rating

integer
Filter by risk rating from 0 to 5

Example: 4

page

integer
Page number

Default: 1

outputsize

integer
Number of records in response

Default: 100

Request example

https://api.twelvedata.com/mutual_funds/list?apikey=demo
Response

{
"result": {
"count": 1000,
"list": [
{
"symbol": "0P0001LCQ3",
"name": "JNL Small Cap Index Fund (I)",
"country": "United States",
"fund_family": "Jackson National",
"fund_type": "Small Blend",
"performance_rating": 2,
"risk_rating": 4,
"currency": "USD",
"exchange": "OTC",
"mic_code": "OTCM"
}
]
},
"status": "ok"
}
MF full data
High demand
/mutual_funds/world
The mutual full data endpoint provides detailed information about global mutual funds. It returns a comprehensive dataset that includes a summary of the fund, its performance metrics, risk assessment, ratings, asset composition, purchase details, and sustainability factors. This endpoint is essential for users seeking in-depth insights into mutual funds on a global scale, allowing them to evaluate various aspects such as investment performance, risk levels, and environmental impact.

API credits cost

1000 per request

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of mutual fund

Example: 1535462D

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG00HMMLCH1

isin

string
Filter by international securities identification number (ISIN)

Example: LU1206782309

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 120678230

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

dp

integer
Number of decimal places for floating values. Accepts value in range [0,11]

Default: 5

Request example

https://api.twelvedata.com/mutual_funds/world?symbol=1535462D&apikey=demo
Response

{
"mutual_fund": {
"summary": {
"symbol": "0P0001LCQ3",
"name": "JNL Small Cap Index Fund (I)",
"fund_family": "Jackson National",
"fund_type": "Small Blend",
"currency": "USD",
"share_class_inception_date": "2021-04-26",
"ytd_return": -0.02986,
"expense_ratio_net": 0.001,
"yield": 0,
"nav": 10.09,
"min_investment": 0,
"turnover_rate": 0.32,
"net_assets": 2400762112,
"overview": "The fund invests, normally, at least 80% of its assets in the stocks...",
"people": [
{
"name": "John Doe",
"tenure_since": "2018-01-01"
}
]
},
"performance": {
"trailing_returns": [
{
"period": "ytd",
"share_class_return": -0.02986,
"category_return": 0.2019,
"rank_in_category": 76
}
],
"annual_total_returns": [
{
"year": 2024,
"share_class_return": 0.08546,
"category_return": 0.1119
}
],
"quarterly_total_returns": [
{
"year": 2024,
"q1": 0.02358,
"q2": -0.03071,
"q3": 0.10099,
"q4": -0.00629
}
],
"load_adjusted_return": [
{
"period": "1_year",
"return": 0.06139
}
]
},
"risk": {
"volatility_measures": [
{
"period": "3_year",
"alpha": -9.12,
"alpha_category": -0.0939,
"beta": 1,
"beta_category": 0.0126,
"mean_annual_return": 0.45,
"mean_annual_return_category": 0.0117,
"r_squared": 69,
"r_squared_category": 0.8309,
"std": 23.15,
"std_category": 0.2554,
"sharpe_ratio": 0.04,
"sharpe_ratio_category": 0.005,
"treynor_ratio": -1.41,
"treynor_ratio_category": 0.0806
}
],
"valuation_metrics": {
"price_to_earnings": 0.05695,
"price_to_earnings_category": 20.63,
"price_to_book": 0.55626,
"price_to_book_category": 2.87,
"price_to_sales": 0.97803,
"price_to_sales_category": 1.34,
"price_to_cashflow": 0.10564,
"price_to_cashflow_category": 11.81,
"median_market_capitalization": 2965,
"median_market_capitalization_category": 4925,
"3_year_earnings_growth": 16.32,
"3_year_earnings_growths_category": 10.55
}
},
"ratings": {
"performance_rating": 2,
"risk_rating": 4,
"return_rating": 0
},
"composition": {
"major_market_sectors": [
{
"sector": "Industrials",
"weight": 0.1742
}
],
"asset_allocation": {
"cash": 0.0043,
"stocks": 0.9956,
"preferred_stocks": 0,
"convertables": 0,
"bonds": 0,
"others": 0
},
"top_holdings": [
{
"symbol": "BBWI",
"name": "Bath & Body Works Inc",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"weight": 0.00624
}
],
"bond_breakdown": {
"average_maturity": {
"fund": null,
"category": 1.97
},
"average_duration": {
"fund": null,
"category": 1.64
},
"credit_quality": [
{
"grade": "U.S. Government",
"weight": 0
}
]
}
},
"purchase_info": {
"expenses": {
"expense_ratio_gross": 0.0022,
"expense_ratio_net": 0.001
},
"minimums": {
"initial_investment": 0,
"additional_investment": 0,
"initial_ira_investment": null,
"additional_ira_investment": null
},
"pricing": {
"nav": 10.09,
"12_month_low": 9.630000114441,
"12_month_high": 12.10000038147,
"last_month": 11.050000190735
},
"brokerages": []
},
"sustainability": {
"score": 22,
"corporate_esg_pillars": {
"environmental": 3.73,
"social": 10.44,
"governance": 7.86
},
"sustainable_investment": false,
"corporate_aum": 0.99486
}
},
"status": "ok"
}
Summary
/mutual_funds/world/summary
The mutual funds summary endpoint provides a concise overview of global mutual funds, including key details such as fund name, symbol, asset class, and region. This endpoint is useful for quickly obtaining essential information about various mutual funds worldwide, aiding in the comparison and selection of funds for investment portfolios.

API credits cost

200 per request

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of mutual fund

Example: 1535462D

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG00HMMLCH1

isin

string
Filter by international securities identification number (ISIN)

Example: LU1206782309

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 120678230

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

dp

integer
Number of decimal places for floating values. Accepts value in range [0,11]

Default: 5

Request example

https://api.twelvedata.com/mutual_funds/world/summary?symbol=1535462D&apikey=demo
Response

{
"mutual_fund": {
"summary": {
"symbol": "0P0001LCQ3",
"name": "JNL Small Cap Index Fund (I)",
"fund_family": "Jackson National",
"fund_type": "Small Blend",
"currency": "USD",
"share_class_inception_date": "2021-04-26",
"ytd_return": -0.02986,
"expense_ratio_net": 0.001,
"yield": 0,
"nav": 10.09,
"min_investment": 0,
"turnover_rate": 0.32,
"net_assets": 2400762112,
"overview": "The fund invests, normally, at least 80% of its assets in the stocks...",
"people": [
{
"name": "John Doe",
"tenure_since": "2018-01-01"
}
]
}
},
"status": "ok"
}
Performance
High demand
/mutual_funds/world/performance
The mutual funds performances endpoint provides comprehensive performance data for mutual funds globally. It returns metrics such as trailing returns, annual returns, quarterly returns, and load-adjusted returns.

API credits cost

200 per request

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of mutual fund

Example: 1535462D

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG00HMMLCH1

isin

string
Filter by international securities identification number (ISIN)

Example: LU1206782309

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 120678230

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

dp

integer
Number of decimal places for floating values. Accepts value in range [0,11]

Default: 5

Request example

https://api.twelvedata.com/mutual_funds/world/performance?symbol=1535462D&apikey=demo
Response

{
"mutual_fund": {
"performance": {
"trailing_returns": [
{
"period": "ytd",
"share_class_return": -0.02986,
"category_return": 0.2019,
"rank_in_category": 76
}
],
"annual_total_returns": [
{
"year": 2024,
"share_class_return": 0.08546,
"category_return": 0.1119
}
],
"quarterly_total_returns": [
{
"year": 2024,
"q1": 0.02358,
"q2": -0.03071,
"q3": 0.10099,
"q4": -0.00629
}
],
"load_adjusted_return": [
{
"period": "1_year",
"return": 0.06139
}
]
}
},
"status": "ok"
}
Risk
/mutual_funds/world/risk
The mutual funds risk endpoint provides detailed risk metrics for global mutual funds. It returns data such as standard deviation, beta, and Sharpe ratio, which help assess the volatility and risk profile of mutual funds across different markets.

API credits cost

200 per request

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of mutual fund

Example: 1535462D

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG00HMMLCH1

isin

string
Filter by international securities identification number (ISIN)

Example: LU1206782309

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 120678230

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

dp

integer
Number of decimal places for floating values. Accepts value in range [0,11]

Default: 5

Request example

https://api.twelvedata.com/mutual_funds/world/risk?symbol=1535462D&apikey=demo
Response

{
"mutual_fund": {
"risk": {
"volatility_measures": [
{
"period": "3_year",
"alpha": -9.12,
"alpha_category": -0.0939,
"beta": 1,
"beta_category": 0.0126,
"mean_annual_return": 0.45,
"mean_annual_return_category": 0.0117,
"r_squared": 69,
"r_squared_category": 0.8309,
"std": 23.15,
"std_category": 0.2554,
"sharpe_ratio": 0.04,
"sharpe_ratio_category": 0.005,
"treynor_ratio": -1.41,
"treynor_ratio_category": 0.0806
}
],
"valuation_metrics": {
"price_to_earnings": 0.05695,
"price_to_earnings_category": 20.63,
"price_to_book": 0.55626,
"price_to_book_category": 2.87,
"price_to_sales": 0.97803,
"price_to_sales_category": 1.34,
"price_to_cashflow": 0.10564,
"price_to_cashflow_category": 11.81,
"median_market_capitalization": 2965,
"median_market_capitalization_category": 4925,
"3_year_earnings_growth": 16.32,
"3_year_earnings_growths_category": 10.55
}
}
},
"status": "ok"
}
Ratings
/mutual_funds/world/ratings
The mutual funds ratings endpoint provides detailed ratings for mutual funds across global markets. It returns data on the performance and quality of mutual funds, including ratings calculated in-house by Twelve Data and from various financial institutions.

API credits cost

200 per request

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of mutual fund

Example: 1535462D

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG00HMMLCH1

isin

string
Filter by international securities identification number (ISIN)

Example: LU1206782309

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 120678230

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

dp

integer
Number of decimal places for floating values. Accepts value in range [0,11]

Default: 5

Request example

https://api.twelvedata.com/mutual_funds/world/ratings?symbol=1535462D&apikey=demo
Response

{
"mutual_fund": {
"ratings": {
"performance_rating": 2,
"risk_rating": 4,
"return_rating": 0
}
},
"status": "ok"
}
Composition
High demand
/mutual_funds/world/composition
The mutual funds compositions endpoint provides detailed information about the portfolio composition of a specified mutual fund. It returns data on sector allocations, individual holdings, and their respective weighted exposures. This endpoint is useful for users seeking to understand the investment distribution and risk profile of a mutual fund.

API credits cost

200 per request

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of mutual fund

Example: 1535462D

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG00HMMLCH1

isin

string
Filter by international securities identification number (ISIN)

Example: LU1206782309

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 120678230

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

dp

integer
Number of decimal places for floating values. Accepts value in range [0,11]

Default: 5

Request example

https://api.twelvedata.com/mutual_funds/world/composition?symbol=1535462D&apikey=demo
Response

{
"mutual_fund": {
"composition": {
"major_market_sectors": [
{
"sector": "Industrials",
"weight": 0.1742
}
],
"asset_allocation": {
"cash": 0.0043,
"stocks": 0.9956,
"preferred_stocks": 0,
"convertables": 0,
"bonds": 0,
"others": 0
},
"top_holdings": [
{
"symbol": "BBWI",
"name": "Bath & Body Works Inc",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"weight": 0.00624
}
],
"bond_breakdown": {
"average_maturity": {
"fund": null,
"category": 1.97
},
"credit_quality": [
{
"grade": "U.S. Government",
"weight": 0
}
],
"average_duration": {
"fund": null,
"category": 1.64
}
}
}
},
"status": "ok"
}
Purchase info
/mutual_funds/world/purchase_info
The mutual funds purchase information endpoint provides detailed purchasing details for global mutual funds. It returns data on minimum investment requirements, current pricing, and a list of brokerages where the mutual fund can be purchased. This endpoint is useful for users looking to understand the entry requirements and options available for investing in specific mutual funds.

API credits cost

200 per request

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of mutual fund

Example: 1535462D

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG00HMMLCH1

isin

string
Filter by international securities identification number (ISIN)

Example: LU1206782309

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 120678230

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

dp

integer
Number of decimal places for floating values. Accepts value in range [0,11]

Default: 5

Request example

https://api.twelvedata.com/mutual_funds/world/purchase_info?symbol=1535462D&apikey=demo
Response

{
"mutual_fund": {
"purchase_info": {
"expenses": {
"expense_ratio_gross": 0.0022,
"expense_ratio_net": 0.001
},
"minimums": {
"initial_investment": 0,
"additional_investment": 0,
"initial_ira_investment": null,
"additional_ira_investment": null
},
"pricing": {
"nav": 10.09,
"12_month_low": 9.630000114441,
"12_month_high": 12.10000038147,
"last_month": 11.050000190735
},
"brokerages": []
}
},
"status": "ok"
}
Sustainability
/mutual_funds/world/sustainability
The mutual funds sustainability endpoint provides detailed information on the sustainability and Environmental, Social, and Governance (ESG) ratings of global mutual funds. It returns data such as ESG scores, sustainability metrics, and fund identifiers.

API credits cost

200 per request

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of mutual fund

Example: 1535462D

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG00HMMLCH1

isin

string
Filter by international securities identification number (ISIN)

Example: LU1206782309

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 120678230

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

dp

integer
Number of decimal places for floating values. Accepts value in range [0,11]

Default: 5

Request example

https://api.twelvedata.com/mutual_funds/world/sustainability?symbol=1535462D&apikey=demo
Response

{
"mutual_fund": {
"sustainability": {
"score": 22,
"corporate_esg_pillars": {
"environmental": 3.73,
"social": 10.44,
"governance": 7.86
},
"sustainable_investment": false,
"corporate_aum": 0.99486
}
},
"status": "ok"
}
MFs families
/mutual_funds/family
The mutual funds family endpoint provides a comprehensive list of MF families, which are groups of mutual funds managed by the same investment company. This data is useful for users looking to explore or compare different fund families, understand the range of investment options offered by each, and identify potential investment opportunities within specific fund families.

API credits cost

1 per request

Parameters
Response
country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

fund_family

string
Filter by investment company that manages the fund

Example: Jackson National

Request example

https://api.twelvedata.com/mutual_funds/family?apikey=demo
Response

{
"result": {
"India": [
"Aberdeen Standard Fund Managers Limited",
"Aditya Birla Sun Life AMC Ltd"
],
"United States": [
"Aegon Asset Management UK PLC",
"Ampega Investment GmbH",
"Aviva SpA"
]
},
"status": "ok"
}
MFs types
/mutual_funds/type
This endpoint provides detailed information on various types of mutual funds, such as equity, bond, and balanced funds, allowing users to understand the different investment options available.

API credits cost

1 per request

Parameters
Response
country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

fund_type

string
Filter by the type of fund

Example: Jackson National

Request example

https://api.twelvedata.com/mutual_funds/type?apikey=demo
Response

{
"result": {
"Singapore": [
"Property - Indirect Asia",
"Sector Equity Water",
"SGD Bond",
"Singapore Equity",
"Taiwan Large-Cap Equity"
],
"United States": [
"Asia-Pacific ex-Japan Equity",
"EUR Flexible Allocation - Global",
"Euro Short Bond PP",
"Large Blend",
"Other Allocation"
]
},
"status": "ok"
}
Technical indicators
On-demand calculation of popular indicators (SMA, EMA, RSI, MACD, Bollinger Bands, etc.) over any supported time series. Streamline chart overlays, signal generation, and backtesting without external libraries.

Overlap studies
Plotted directly on the price chart to smooth or envelope price data, highlighting trend direction, support/resistance, and mean-reversion levels (e.g. moving averages, Bollinger Bands, Parabolic SAR, Ichimoku Cloud, Keltner Channels, McGinley Dynamic).

Bollinger bands
High demand
/bbands
The Bollinger Bands (BBANDS) endpoint calculates and returns three key data points: an upper band, a lower band, and a simple moving average (SMA) for a specified financial instrument. These bands are used to assess market volatility by showing how far prices deviate from the SMA. This information helps users identify potential price reversals and determine whether an asset is overbought or oversold.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

ma_type

string
The type of moving average used

Supports: SMA, EMA, WMA, DEMA, TEMA, TRIMA, KAMA, MAMA, T3MA

Default: SMA

sd

double
Number of standard deviations. Must be at least 1

Default: 2

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 20

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/bbands?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "BBANDS - Bollinger Bands\u00ae",
"series_type": "close",
"time_period": 20,
"sd": 2,
"ma_type": "SMA"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"upper_band": "203.36511",
"middle_band": "202.04999",
"lower_band": "200.73486"
}
],
"status": "ok"
}
Double exponential moving average
/dema
The Double Exponential Moving Average (DEMA) endpoint provides a data series that calculates a moving average with reduced lag by emphasizing recent price data. This endpoint returns time-series data that includes the DEMA values for a specified financial instrument, allowing users to track price trends and identify potential trading opportunities.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/dema?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "DEMA - Double Exponential Moving Average",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"dema": "200.93371"
}
],
"status": "ok"
}
Exponential moving average
High demand
/ema
The Exponential Moving Average (EMA) endpoint calculates the EMA for a specified financial instrument over a given time period. It returns a time series of EMA values, which highlight recent price trends by weighting recent data more heavily. This is useful for traders seeking to identify trend directions and potential trade opportunities based on recent price movements.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/ema?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "EMA - Exponential Moving Average",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"ema": "201.38109"
}
],
"status": "ok"
}
Hilbert transform instantaneous trendline
/ht_trendline
The Hilbert Transform Instantaneous Trendline (HT_TRENDLINE) endpoint provides a smoothed moving average that aligns with the dominant market cycle. It returns data points that help traders identify current market trends and determine potential entry or exit points in trading.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/ht_trendline?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "HT_TRENDLINE - Hilbert Transform Instantaneous Trendline",
"series_type": "close"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"ht_trendline": "202.26597"
}
],
"status": "ok"
}
Ichimoku cloud
/ichimoku
The Ichimoku Cloud endpoint provides data on the Ichimoku Kinko Hyo indicator, offering insights into trend direction, support and resistance levels, and potential entry and exit points. It returns key components such as the Tenkan-sen, Kijun-sen, Senkou Span A, Senkou Span B, and Chikou Span. This data helps users evaluate market trends and identify strategic trading opportunities.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

conversion_line_period

integer
The time period used for generating the conversation line. Takes values in the range from 1 to 800

Default: 9

base_line_period

integer
The time period used for generating the base line. Takes values in the range from 1 to 800

Default: 26

leading_span_b_period

integer
The time period used for generating the leading span B line. Takes values in the range from 1 to 800

Default: 52

lagging_span_period

integer
The time period used for generating the lagging span line. Takes values in the range from 1 to 800

Default: 26

include_ahead_span_period

boolean
Indicates whether to include ahead span period

Default: true

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/ichimoku?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "ICHIMOKU - Ichimoku Kink\u014d Hy\u014d",
"conversion_line_period": 9,
"base_line_period": 26,
"leading_span_b_period": 52,
"lagging_span_period": 26,
"include_ahead_span_period": true
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"tenkan_sen": "200.33",
"kijun_sen": "201.42",
"senkou_span_a": "201.49",
"senkou_span_b": "200.35501",
"chikou_span": "199.95499"
}
],
"status": "ok"
}
Kaufman adaptive moving average
/kama
The Kaufman Adaptive Moving Average (KAMA) endpoint calculates the KAMA for a specified financial instrument, returning a time series of values that reflect the average price adjusted for market volatility. This endpoint helps users identify trends by smoothing out price fluctuations while remaining sensitive to significant price movements.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/kama?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "KAMA - Kaufman's Adaptive Moving Average",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"kama": "201.06741"
}
],
"status": "ok"
}
Keltner channel
/keltner
The Keltner Channel endpoint provides data for a volatility-based technical indicator that combines the Exponential Moving Average (EMA) and the Average True Range (ATR) to form a channel around a security's price. This endpoint returns the upper, middle, and lower bands of the channel, which can be used to identify potential overbought or oversold conditions, assess trend direction, and detect possible price breakouts.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 20

atr_time_period

integer
The time period used for calculating the Average True Range. Takes values in the range from 1 to 800

Default: 10

multiplier

integer
The factor used to adjust the indicator's sensitivity

Default: 2

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

ma_type

string
The type of moving average used

Supports: SMA, EMA, WMA, DEMA, TEMA, TRIMA, KAMA, MAMA, T3MA

Default: SMA

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/keltner?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "KELTNER - Keltner Channels",
"time_period": 20,
"atr_time_period": 10,
"multiplier": 2,
"series_type": "close",
"ma_type": "SMA"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"upper_line": "202.25298",
"middle_line": "201.80985",
"lower_line": "201.36672"
}
],
"status": "ok"
}
Moving average
/ma
The Moving Average (MA) endpoint provides the average price of a security over a specified time frame, offering a smoothed representation of price data. This endpoint returns the calculated moving average values, which can assist users in identifying price trends and potential support or resistance levels in the market.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

ma_type

string
The type of moving average used

Supports: SMA, EMA, WMA, DEMA, TEMA, TRIMA, KAMA, MAMA, T3MA

Default: SMA

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/ma?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "MA - Moving Average",
"series_type": "close",
"time_period": 9,
"ma_type": "SMA"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"ma": "201.41205"
}
],
"status": "ok"
}
MESA adaptive moving average
/mama
The MESA Adaptive Moving Average (MAMA) endpoint calculates a moving average that adjusts to the dominant market cycle, offering a balance between quick response to price changes and noise reduction. It returns data that includes the adaptive moving average values, which can be used to identify trends and potential reversal points.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

fast_limit

double
The limit for the fast moving average.

Default: 0.5

slow_limit

double
The limit for the slow moving average.

Default: 0.05

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/mama?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "MAMA - MESA Adaptive Moving Average",
"series_type": "close",
"fast_limit": 0.5,
"slow_limit": 0.05
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"mama": "201.38887",
"fama": "202.05517"
}
],
"status": "ok"
}
McGinley dynamic indicator
/mcginley_dynamic
This endpoint calculates the McGinley Dynamic (MCGINLEY_DYNAMIC) indicator, which provides a refined moving average that adapts to market volatility. This endpoint returns data that reflects smoother price trends and identifies potential support or resistance levels more accurately than traditional moving averages. It is useful for users seeking to track price movements with reduced lag and enhanced responsiveness to market changes.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 14

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/mcginley_dynamic?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "MCGINLEY_DYNAMIC - McGinley Dynamic",
"time_period": 14
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"mcginley_dynamic": "201.93983"
}
],
"status": "ok"
}
Midpoint
/midpoint
The Midpoint (MIDPOINT) endpoint calculates the average value between the highest and lowest prices of a financial instrument over a specified period. It returns a time series of midpoint values, which can help users identify price trends and smooth out short-term fluctuations in the data.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/midpoint?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "MIDPOINT - MidPoint over period",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"midpoint": "201.4925"
}
],
"status": "ok"
}
Midprice
/midprice
The Midprice (MIDPRICE) endpoint calculates and returns the average of a financial instrument's highest and lowest prices over a specified time period. This data provides a smoothed representation of price movements, helping users identify potential support or resistance levels in the market.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/midprice?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "MIDPRICE - Midpoint Price over period",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"midprice": "201.535"
}
],
"status": "ok"
}
Pivot points high low
/pivot_points_hl
The Pivot Points High Low (PIVOT_POINTS_HL) endpoint calculates key support and resistance levels for a security by analyzing its highest and lowest prices over a specified period. This endpoint returns data that includes pivot points, support levels, and resistance levels, which can be used to identify potential price reversal zones and optimize trade entry and exit strategies.

API credits cost

1 per symbol

This API endpoint is available starting with the Pro plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 10

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/pivot_points_hl?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "PIVOT_POINTS_HL - Pivot Points (High/Low)",
"time_period": 10
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"pivot_point_h": 1,
"pivot_point_l": 0
}
],
"status": "ok"
}
Parabolic stop and reverse
/sar
The Parabolic Stop and Reverse (SAR) endpoint provides data on potential support and resistance levels for a specified security, using its price and time. This endpoint returns numerical values that help traders determine possible entry and exit points in their trading strategies.

API credits cost

1 per symbol

This API endpoint is available starting with the Grow plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

acceleration

double
The rate of change in the indicator's values.

Default: 0.02

maximum

double
The maximum value considered for the indicator calculation.

Default: 0.2

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/sar?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "SAR - Parabolic SAR",
"acceleration": 0.02,
"maximum": 0.2
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"sar": "201.54365"
}
],
"status": "ok"
}
Parabolic stop and reverse extended
/sarext
The Parabolic SAR Extended (SAREXT) endpoint provides a customizable version of the Parabolic SAR indicator, which is used to identify potential entry and exit points in trading. Users can adjust parameters such as acceleration factors to tailor the indicator to specific trading strategies. The endpoint returns data points indicating potential trend reversals.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

start_value

double
The initial value for the indicator calculation.

Default: 0

offset_on_reverse

double
The adjustment applied when the indicator's direction changes.

Default: 0

acceleration_limit_long

double
The maximum acceleration value for long positions.

Default: 0.02

acceleration_long

double
The acceleration value for long positions.

Default: 0.02

acceleration_max_long

double
The highest allowed acceleration for long positions.

Default: 0.2

acceleration_limit_short

double
The maximum acceleration value for short positions.

Default: 0.02

acceleration_short

double
The acceleration value for short positions.

Default: 0.02

acceleration_max_short

double
The highest allowed acceleration for short positions.

Default: 0.2

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/sarext?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "SAREXT - Parabolic SAR Extended",
"start_value": 0,
"offset_on_reverse": 0,
"acceleration_limit_long": 0.02,
"acceleration_long": 0.02,
"acceleration_max_long": 0.2,
"acceleration_limit_short": 0.02,
"acceleration_short": 0.02,
"acceleration_max_short": 0.2
}
},
"values": [
{
"datetime": "2025-04-02",
"sarext": "214.059460"
}
],
"status": "ok"
}
Simple moving average
High demand
/sma
The Simple Moving Average (SMA) endpoint calculates and returns the average price of a security over a user-defined time period. This endpoint provides a series of data points that represent the smoothed price trend, which can help users identify potential price movements and evaluate historical price behavior.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/sma?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "SMA - Simple Moving Average",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"sma": "201.41205"
}
],
"status": "ok"
}
Triple exponential moving average
/t3ma
The Triple Exponential Moving Average (T3MA) endpoint calculates a smoothed moving average using three exponential moving averages on price data. It returns a dataset that highlights price trends with reduced lag, offering precise trend analysis. This is useful for identifying trend direction and potential reversal points.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

v_factor

double
The factor used to adjust the indicator's volatility. Takes values in the range from 0 to 1

Default: 0.7

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/t3ma?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "T3MA - Triple Exponential Moving Average",
"series_type": "close",
"time_period": 9,
"v_factor": 0.7
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"t3ma": "201.56277"
}
],
"status": "ok"
}
Triple exponential moving average
/tema
The Triple Exponential Moving Average (TEMA) endpoint calculates and returns the TEMA values for a specified financial instrument over a given time period. This endpoint provides a series of data points that smooth out price fluctuations by applying three layers of exponential moving averages, allowing users to identify and track underlying trends in the instrument's price movement.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
The time period used for calculation in the indicator. Default is 9.

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/tema?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "TEMA - Triple Exponential Moving Average",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"tema": "200.83136"
}
],
"status": "ok"
}
Triangular moving average
/trima
The Triangular Moving Average (TRIMA) endpoint calculates and returns the smoothed average price of a financial security over a specified period, with a focus on central data points. This endpoint provides a balanced view of price trends by applying a double smoothing process, making it useful for identifying underlying price patterns and reducing short-term fluctuations.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/trima?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "TRIMA - Triangular Moving Average",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"trima": "201.36415"
}
],
"status": "ok"
}
Volume weighted average price
/vwap
The Volume Weighted Average Price (VWAP) endpoint provides the VWAP value for a specified stock or asset over a given time period. This indicator calculates the average price at which a security has traded throughout the day, based on both volume and price. It is useful for identifying the true average price of an asset, helping traders to assess the current price relative to the day's average.

API credits cost

1 per symbol

Take note that this endpoint is applicable to all instruments except currencies.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

sd

double
The standard deviation applied in the calculation. Must be greater than 0. Recommended value is 2. This parameter is only used together with sd_time_period.

Default: 0

sd_time_period

integer
The time period for the standard deviation calculation. Must be greater than 0. Recommended value is 9. This parameter is only used together with sd.

Default: 0

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/vwap?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "VWAP - Volume Weighted Average Price",
"sd_time_period": 0,
"sd": 0
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"vwap_lower": 201.05266,
"vwap": 201.05266,
"vwap_upper": 201.05266
}
],
"status": "ok"
}
Weighted moving average
/wma
The Weighted Moving Average (WMA) endpoint calculates and returns the WMA values for a given security over a specified period. This endpoint provides a time series of weighted averages, where recent prices have a higher influence, allowing users to track and analyze short-term price trends effectively.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/wma?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "WMA - Weighted Moving Average",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"wma": "201.20579"
}
],
"status": "ok"
}
Momentum indicators
Oscillators that measure the speed or strength of price movement, helping detect overbought/oversold conditions, divergences, and shifts in trend momentum (e.g. RSI, MACD, ROC, Stochastics, ADX, CCI, Coppock Curve, TRIX).

Average directional index
High demand
/adx
The Average Directional Index (ADX) endpoint provides data on the strength of a market trend, regardless of its direction. It returns a numerical value that helps users identify whether a market is trending or moving sideways.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 14

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/adx?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "ADX - Average Directional Index",
"time_period": 14
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"adx": "49.22897"
}
],
"status": "ok"
}
Average directional movement index rating
/adxr
The Average Directional Movement Index Rating (ADXR) endpoint provides a smoothed measure of trend strength for a specified financial instrument. It returns the ADXR values, which help users assess the consistency of a trend over a given period by reducing short-term fluctuations. This endpoint is useful for traders and analysts who need to evaluate the stability of market trends for better timing of entry and exit points in their trading strategies.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 14

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/adxr?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "ADXR - Average Directional Movement Index Rating",
"time_period": 14
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"adxr": "37.43665"
}
],
"status": "ok"
}
Absolute price oscillator
/apo
The Absolute Price Oscillator (APO) endpoint calculates the difference between two specified moving averages of a financial instrument's price, providing data that helps users identify potential price trends and reversals. The response includes the calculated APO values over a specified time period, which can be used to track momentum changes and assess the strength of price movements.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

fast_period

integer
Number of periods for fast moving average. Takes values in the range from 1 to 800

Default: 12

ma_type

string
The type of moving average used

Supports: SMA, EMA, WMA, DEMA, TEMA, TRIMA, KAMA, MAMA, T3MA

Default: SMA

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

slow_period

integer
Number of periods for slow moving average. Takes values in the range from 1 to 800

Default: 26

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/apo?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "APO - Absolute Price Oscillator",
"series_type": "close",
"fast_period": 12,
"slow_period": 26,
"ma_type": "SMA"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"apo": "-0.54508"
}
],
"status": "ok"
}
Aroon indicator
/aroon
The Aroon Indicator endpoint provides data on the time elapsed since the highest high and lowest low within a specified period, helping users identify the presence and strength of market trends. It returns two values: Aroon Up and Aroon Down, which indicate the trend direction and momentum. This endpoint is useful for traders and analysts looking to assess trend patterns and potential reversals in financial markets.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 14

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/aroon?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "AROON - Aroon Indicator",
"time_period": 14
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"aroon_down": "92.85714",
"aroon_up": "0.0"
}
],
"status": "ok"
}
Aroon oscillator
/aroonosc
The Aroon Oscillator endpoint provides the calculated difference between the Aroon Up and Aroon Down indicators for a given financial instrument. It returns a time series of values that help users identify the strength and direction of a trend, as well as potential trend reversals. This data is useful for traders and analysts seeking to evaluate market trends over a specified period.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 14

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/aroonosc?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "AROONOSC - Aroon Oscillator",
"time_period": 14
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"aroonosc": "-92.85714"
}
],
"status": "ok"
}
Balance of power
/bop
The Balance of Power (BOP) endpoint provides data on the buying and selling pressure of a security by analyzing its open, high, low, and close prices. It returns numerical values that help users detect shifts in market sentiment and potential price movements.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/bop?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "BOP - Balance of Power"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"bop": "0.27231"
}
],
"status": "ok"
}
Commodity channel index
/cci
The Commodity Channel Index (CCI) endpoint provides data on the CCI values for a specified security, helping users detect potential price reversals by identifying overbought or oversold conditions. It returns a series of CCI values calculated over a specified time period, allowing users to assess the momentum of a security relative to its average price range.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 20

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/cci?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "CCI - Commodity Channel Index",
"time_period": 20
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"cci": "-122.30794"
}
],
"status": "ok"
}
Chande momentum oscillator
/cmo
The Chande Momentum Oscillator (CMO) endpoint provides data on the momentum of a security by calculating the relative strength of recent price movements. It returns a numerical value indicating whether a security is potentially overbought or oversold, assisting users in identifying possible trend reversals.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/cmo?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "CMO - Chande Momentum Oscillator",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"cmo": "-71.24979"
}
],
"status": "ok"
}
Coppock curve
/coppock
The Coppock Curve is a momentum oscillator used to detect potential long-term trend reversals in financial markets. It returns the calculated values of this indicator over a specified period, allowing users to identify when a security's price may be shifting from a downtrend to an uptrend. This endpoint is particularly useful for analyzing securities in bottoming markets.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

long_roc_period

integer
Number of periods for long term rate of change. Takes values in the range from 1 to 800

Default: 14

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

short_roc_period

integer
Number of periods for short term rate of change. Takes values in the range from 1 to 800

Default: 11

wma_period

integer
Number of periods for weighted moving average. Takes values in the range from 1 to 800

Default: 10

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/coppock?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "COPPOCK - Coppock Curve",
"series_type": "close",
"wma_period": 10,
"long_roc_period": 14,
"short_roc_period": 11
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"coppock": "-1.37253"
}
],
"status": "ok"
}
Connors relative strength index
/crsi
The Connors Relative Strength Index (CRSI) endpoint provides a detailed analysis of stock momentum by combining three components: the Relative Strength Index, the Rate of Change, and the Up/Down Length. This endpoint returns a numerical value that helps identify potential trend reversals and momentum shifts in a security's price. Ideal for traders seeking to refine entry and exit points, the CRSI offers a nuanced view of market conditions beyond traditional RSI indicators.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

percent_rank_period

integer
Number of periods used to calculate PercentRank. Takes values in the range from 1 to 800

Default: 100

rsi_period

integer
Number of periods for RSI used to calculate price momentum. Takes values in the range from 1 to 800

Default: 3

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

up_down_length

integer
Number of periods for RSI used to calculate up/down trend. Takes values in the range from 1 to 800

Default: 2

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/crsi?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "CRSI - ConnorsRSI",
"series_type": "close",
"rsi_period": 3,
"up_down_length": 2,
"percent_rank_period": 100
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"crsi": "74.76102"
}
],
"status": "ok"
}
Detrended price oscillator
/dpo
The Detrended Price Oscillator (DPO) endpoint calculates and returns the DPO values for a specified financial instrument over a given time period. This endpoint helps traders by highlighting short-term price cycles and identifying potential overbought or oversold conditions without the influence of long-term trends. The response includes a series of DPO values, which can be used to assess price momentum and cyclical patterns in the market.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

centered

boolean
Specifies if there should be a shift to match the current price

Default: false

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/dpo?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "DPO - Detrended Price Oscillator",
"series_type": "close",
"time_period": 21,
"centered": false
}
},
"values": [
{
"datetime": "2025-04-01",
"dpo": "-7.99619"
}
],
"status": "ok"
}
Directional movement index
/dx
Retrieve the Directional Movement Index (DX) values for a given security to assess the strength of its positive and negative price movements. This endpoint provides a time series of DX values, which are useful for evaluating the momentum and trend direction of the security over a specified period.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 14

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/dx?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "DX - Directional Movement Index",
"time_period": 14
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"dx": "68.70803"
}
],
"status": "ok"
}
Know sure thing
/kst
The Know Sure Thing (KST) endpoint provides a momentum oscillator that combines four smoothed rates of change into a single trend-following indicator. This endpoint returns data that helps users identify potential trend reversals, as well as overbought or oversold conditions in the market.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

roc_period_1

integer
The time period for the first Rate of Change calculation.

Default: 10

roc_period_2

integer
The time period for the second Rate of Change calculation.

Default: 15

roc_period_3

integer
The time period for the third Rate of Change calculation.

Default: 20

roc_period_4

integer
The time period for the forth Rate of Change calculation.

Default: 30

sma_period_1

integer
The time period for the first Simple Moving Average.

Default: 10

sma_period_2

integer
The time period for the second Simple Moving Average.

Default: 10

sma_period_3

integer
The time period for the third Simple Moving Average.

Default: 10

sma_period_4

integer
The time period for the forth Simple Moving Average.

Default: 15

signal_period

integer
The time period used for generating the signal line.

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/kst?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "KST - Know Sure Thing",
"roc_period_1": 10,
"roc_period_2": 15,
"roc_period_3": 20,
"roc_period_4": 30,
"sma_period_1": 10,
"sma_period_2": 10,
"sma_period_3": 10,
"sma_period_4": 15,
"signal_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"kst": "-4.58644",
"kst_signal": "-2.05236"
}
],
"status": "ok"
}
Moving average convergence divergence
High demand
/macd
This endpoint calculates the Moving Average Convergence Divergence (MACD) for a specified financial instrument. It returns the MACD line, signal line, and histogram values, which help users identify potential trend reversals and trading opportunities by analyzing the relationship between two moving averages.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

fast_period

integer
Number of periods for fast moving average. Takes values in the range from 1 to 800

Default: 12

slow_period

integer
Number of periods for slow moving average. Takes values in the range from 1 to 800

Default: 26

signal_period

integer
The time period used for generating the signal line.

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/macd?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "MACD - Moving Average Convergence Divergence",
"series_type": "close",
"fast_period": 12,
"slow_period": 26,
"signal_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"macd": "-0.3998",
"macd_signal": "-0.25279",
"macd_hist": "-0.147"
}
],
"status": "ok"
}
Moving average convergence divergence slope
/macd_slope
The Moving Average Convergence Divergence (MACD) Slope endpoint provides the rate of change of the MACD line for a given security. It returns data on how quickly the MACD line is rising or falling, offering insights into the momentum shifts in the security's price. This information is useful for traders looking to gauge the speed of price movements and potential trend reversals.

API credits cost

1 per symbol

This API endpoint is available starting with the Pro plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

fast_period

integer
Number of periods for fast moving average. Takes values in the range from 1 to 800

Default: 12

slow_period

integer
Number of periods for slow moving average. Takes values in the range from 1 to 800

Default: 26

signal_period

integer
The time period used for generating the signal line.

Default: 9

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/macd_slope?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "MACD_SLOPE - Moving Average Convergence Divergence Regression Slope",
"series_type": "close",
"fast_period": 12,
"slow_period": 26,
"signal_period": 9,
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"macd_slope": "0.13358",
"macd_signal_slope": "0.05345",
"macd_hist_slope": "0.08013"
}
],
"status": "ok"
}
Moving average convergence divergence extension
/macdext
The Moving Average Convergence Divergence Extension (MACDEXT) endpoint provides a customizable version of the MACD indicator, allowing users to specify different moving average types and parameters. It returns data that includes the MACD line, signal line, and histogram values, tailored to the user's chosen settings. This endpoint is useful for traders who require flexibility in analyzing price trends and momentum by adjusting the calculation methods to fit their specific trading strategies.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

fast_period

integer
Number of periods for fast moving average. Takes values in the range from 1 to 800

Default: 12

fast_ma_type

string
The type of fast moving average used in the calculation.

Supports: SMA, EMA, WMA, DEMA, TEMA, TRIMA, KAMA, MAMA, T3MA

Default: SMA

slow_period

integer
Number of periods for slow moving average. Takes values in the range from 1 to 800

Default: 26

slow_ma_type

string
The type of slow moving average used in the calculation.

Supports: SMA, EMA, WMA, DEMA, TEMA, TRIMA, KAMA, MAMA, T3MA

Default: SMA

signal_period

integer
The time period used for generating the signal line.

Default: 9

signal_ma_type

string
The type of fast moving average used for generating the signal line.

Supports: SMA, EMA, WMA, DEMA, TEMA, TRIMA, KAMA, MAMA, T3MA

Default: SMA

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/macdext?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "MACDEXT - Moving Average Convergence Divergence Extended",
"series_type": "close",
"fast_period": 12,
"fast_ma_type": "SMA",
"slow_period": 26,
"slow_ma_type": "SMA",
"signal_period": 9,
"signal_ma_type": "SMA"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"macd": "-0.54508",
"macd_signal": "-0.25615",
"macd_hist": "-0.28894"
}
],
"status": "ok"
}
Money flow index
/mfi
The Money Flow Index (MFI) endpoint provides a volume-weighted momentum oscillator that quantifies buying and selling pressure by analyzing positive and negative money flow. It returns data indicating potential overbought or oversold conditions in a financial asset, aiding users in understanding market trends and price movements.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 14

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/mfi?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "MFI - Money Flow Index",
"time_period": 14
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"mfi": "22.68525"
}
],
"status": "ok"
}
Minus directional indicator
/minus_di
The Minus Directional Indicator (MINUS_DI) endpoint calculates and returns the strength of a security's downward price movement over a specified period. This data is useful for traders and analysts looking to identify bearish trends and assess the intensity of price declines in financial markets.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/minus_di?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "MINUS_DI - Minus Directional Indicator",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"minus_di": "46.60579"
}
],
"status": "ok"
}
Minus directional movement
/minus_dm
The Minus Directional Movement endpoint (MINUS_DM) calculates the downward price movement of a security over a specified period. It returns a series of values indicating the strength of downward trends, useful for traders to identify potential selling opportunities or confirm bearish market conditions.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/minus_dm?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "MINUS_DM - Minus Directional Movement",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"minus_dm": "0.96291"
}
],
"status": "ok"
}
Momentum
/mom
The Momentum (MOM) endpoint provides data on the rate of change in a security's price over a user-defined period. It returns a series of numerical values indicating the speed and direction of the price movement, which can help users detect emerging trends or potential reversals in the market.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/mom?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "MOM - Momentum",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"mom": "-1.14"
}
],
"status": "ok"
}
Percent B
High demand
/percent_b
The Percent B (%B) endpoint calculates and returns the %B value, which indicates the position of a security's price relative to its Bollinger Bands. This data helps users determine if a security is near the upper or lower band, potentially signaling overbought or oversold conditions.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

sd

double
The standard deviation applied in the calculation. Must be at least 1

Default: 2

ma_type

string
The type of moving average used

Supports: SMA, EMA, WMA, DEMA, TEMA, TRIMA, KAMA, MAMA, T3MA

Default: SMA

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/percent_b?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "PERCENT_B - %B Indicator",
"series_type": "close",
"time_period": 20,
"sd": 2,
"ma_type": "SMA"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"percent_b": "0.11981"
}
],
"status": "ok"
}
Plus directional indicator
/plus_di
The Plus Directional Indicator endpoint (/plus_di) provides data on the strength of a security's upward price movement by calculating the Plus Directional Indicator (PLUS_DI). It returns a time series of PLUS_DI values, which can be used to assess the intensity of upward trends in a security's price over a specified period.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/plus_di?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "PLUS_DI - Plus Directional Indicator",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"plus_di": "7.69578"
}
],
"status": "ok"
}
Plus directional movement
/plus_dm
The Plus Directional Movement (PLUS_DM) endpoint calculates the upward price movement of a financial security over a specified period. It returns numerical values representing the magnitude of upward price changes, which can be used to assess the strength of an uptrend. This data is essential for traders and analysts who need to evaluate the bullish momentum of a security.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/plus_dm?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "PLUS_DM - Plus Directional Movement",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"plus_dm": "0.159"
}
],
"status": "ok"
}
Percentage price oscillator
/ppo
The Percentage Price Oscillator (PPO) endpoint calculates the percentage difference between two specified moving averages of a financial instrument's price. It returns data that includes the PPO values, which traders can use to identify potential trend reversals and generate trading signals.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

fast_period

integer
Number of periods for fast moving average. Takes values in the range from 1 to 800

Default: 12

slow_period

integer
Number of periods for slow moving average. Takes values in the range from 1 to 800

Default: 26

ma_type

string
The type of moving average used

Supports: SMA, EMA, WMA, DEMA, TEMA, TRIMA, KAMA, MAMA, T3MA

Default: SMA

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/ppo?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "PPO - Percentage Price Oscillator",
"series_type": "close",
"fast_period": 12,
"slow_period": 26,
"ma_type": "SMA"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"ppo": "-0.2696"
}
],
"status": "ok"
}
Rate of change
/roc
The Rate of Change (ROC) endpoint calculates the percentage change in a security's price over a defined period, returning a time series of ROC values. This data helps users track momentum by showing how quickly prices are changing, which can be useful for identifying potential price movements.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/roc?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "ROC - Rate of change",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"roc": "-0.56383"
}
],
"status": "ok"
}
Rate of change percentage
/rocp
The Rate of Change Percentage (ROCP) endpoint calculates and returns the percentage change in the price of a financial security over a user-defined period. This data helps users identify shifts in price momentum and potential trend reversals by providing a clear numerical representation of how much the price has increased or decreased in percentage terms.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/rocp?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "ROCP - Rate of change percentage",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"rocp": "-0.00564"
}
],
"status": "ok"
}
Rate of change ratio
/rocr
The Rate of Change Ratio (ROCR) endpoint calculates and returns the ratio of a security's current price to its price from a specified number of periods ago. This data helps users track price momentum and identify potential trend reversals by providing a clear numerical value that reflects price changes over time.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/rocr?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "ROCR - Rate of change ratio",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"rocr": "0.99436"
}
],
"status": "ok"
}
Rate of change ratio 100
/rocr100
The Rate of Change Ratio 100 (ROCR100) endpoint calculates the percentage change in a security's price over a specified period, expressed as a ratio to 100. It returns data that highlights the momentum of the price movement and identifies potential trend reversals. This endpoint is useful for users looking to assess the strength and direction of a security's price trend over time.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/rocr100?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "ROCR100 - Rate of change ratio 100 scale",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"rocr100": "99.43617"
}
],
"status": "ok"
}
Relative strength index
High demand
/rsi
The Relative Strength Index (RSI) endpoint provides data on the RSI values for a specified financial instrument over a given period. It returns a series of RSI values, which indicate the momentum of price movements and help identify potential overbought or oversold conditions. This data is useful for traders looking to assess the strength of price trends and anticipate possible trend reversals.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 14

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/rsi?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "RSI - Relative Strength Index",
"series_type": "close",
"time_period": 14
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"rsi": "16.57887"
}
],
"status": "ok"
}
Stochastic oscillator
High demand
/stoch
The Stochastic Oscillator endpoint provides data on a momentum indicator that evaluates a security's closing price relative to its price range over a specified timeframe. It returns values indicating potential overbought or oversold conditions, aiding in identifying possible trend reversals. Users receive the %K and %D values, which are essential for analyzing the momentum and potential turning points in the market.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

fast_k_period

integer
The time period for the fast %K line in the Stochastic Oscillator. Takes values in the range from 1 to 800

Default: 14

slow_k_period

integer
The time period for the slow %K line in the Stochastic Oscillator. Takes values in the range from 1 to 800

Default: 1

slow_d_period

integer
The time period for the slow %D line in the Stochastic Oscillator. Takes values in the range from 1 to 800

Default: 3

slow_kma_type

string
The type of slow %K Moving Average used. Default is SMA.

Supports: SMA, EMA, WMA, DEMA, TEMA, TRIMA, KAMA, MAMA, T3MA

Default: SMA

slow_dma_type

string
The type of slow Displaced Moving Average used. Default is SMA.

Supports: SMA, EMA, WMA, DEMA, TEMA, TRIMA, KAMA, MAMA, T3MA

Default: SMA

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/stoch?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "STOCH - Stochastic Oscillator",
"fast_k_period": 14,
"slow_k_period": 1,
"slow_d_period": 3,
"slow_kma_type": "SMA",
"slow_dma_type": "SMA"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"slow_k": "11.35168",
"slow_d": "7.5293"
}
],
"status": "ok"
}
Stochastic fast
/stochf
The Stochastic Fast (STOCHF) endpoint calculates the fast version of the Stochastic Oscillator, providing data on the momentum of a financial instrument by comparing a particular closing price to a range of its prices over a specified period. This endpoint returns the %K and %D values, which are used to identify potential overbought or oversold conditions in the market. It is useful for traders who need quick, responsive insights into price movements, although it may generate more false signals due to its sensitivity.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

fast_k_period

integer
The time period for the fast %K line in the Stochastic Oscillator. Takes values in the range from 1 to 800

Default: 14

fast_d_period

integer
The time period for the fast %D line in the Stochastic Oscillator. Takes values in the range from 1 to 800

Default: 3

fast_dma_type

string
The type of fast Displaced Moving Average used.

Supports: SMA, EMA, WMA, DEMA, TEMA, TRIMA, KAMA, MAMA, T3MA

Default: SMA

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/stochf?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "STOCHF - Stochastic Fast",
"fast_k_period": 14,
"fast_d_period": 3,
"fast_dma_type": "SMA"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"fast_k": "11.35168",
"fast_d": "7.5293"
}
],
"status": "ok"
}
Stochastic relative strength index
/stochrsi
The Stochastic Relative Strength Index (Stochastic RSI) endpoint calculates the Stochastic RSI values for a given financial instrument, providing data on its momentum and potential price reversals. This endpoint returns time-series data, including the %K and %D lines, which help users identify overbought or oversold conditions. Ideal for traders seeking to refine entry and exit points by analyzing short-term price movements.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

stoch_length

integer
Period length for computing the stochastic oscillator of the RSI. Takes values in the range from 1 to 800

Default: 14

k_period

integer
Period for smoothing the %K line. Takes values in the range from 1 to 800

Default: 3

d_period

integer
Period for smoothing the %D line, which is a moving average of %K. Takes values in the range from 1 to 800

Default: 3

series_type

string
Specifies the price data type: open, high, low, or close.

Supports: open, high, low, close

Default: close

rsi_length

integer
Length of period for calculating the RSI component. Takes values in the range from 1 to 800

Default: 14

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

slow_kma_type

string
slow_dma_type

string
prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/stochrsi?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "STOCHRSI - Stochastic RSI",
"series_type": "close",
"rsi_length": 14,
"stoch_length": 14,
"k_period": 3,
"d_period": 3
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"k": "100.0",
"d": "33.33333"
}
],
"status": "ok"
}
Ultimate oscillator endpoint
/ultosc
The Ultimate Oscillator endpoint (/ultosc) calculates a momentum oscillator that integrates short, intermediate, and long-term price movements to detect potential overbought or oversold conditions and possible trend reversals. It returns a time series of oscillator values, which can be used to assess market momentum and identify entry or exit points in trading strategies.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

time_period_1

integer
The first time period used for calculation in the indicator. Takes values in the range from 1 to 800

Default: 7

time_period_2

integer
The second time period used for calculation in the indicator. Takes values in the range from 1 to 800

Default: 14

time_period_3

integer
The third time period used for calculation in the indicator. Takes values in the range from 1 to 800

Default: 28

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/ultosc?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "ULTOSC - Ultimate Oscillator",
"time_period_1": 7,
"time_period_2": 14,
"time_period_3": 28
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"ultosc": "25.17927"
}
],
"status": "ok"
}
Williams %R
/willr
The Williams %R (WILLR) endpoint calculates the Williams Percent Range, a momentum indicator that evaluates a security's closing price relative to its high-low range over a specified period. This endpoint returns data that helps users identify potential overbought or oversold conditions and possible trend reversals in the market.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 14

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/willr?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "WILLR - Williams %R",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"willr": "-84.8916"
}
],
"status": "ok"
}
Volume indicators
Use trading volume to confirm price moves or warn of exhaustion—volume and price in tandem suggest trend strength, while divergences can signal reversals (e.g. OBV, Chaikin AD, Accumulation/Distribution Oscillator).

Accumulation/distribution
/ad
The Accumulation/Distribution (AD) endpoint provides data on the cumulative money flow into and out of a financial instrument, using its closing price, price range, and trading volume. This endpoint returns the AD line, which helps users identify potential buying or selling pressure and assess the strength of price movements.

API credits cost

1 per symbol

Take note that this endpoint is applicable to all instruments except currencies.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/ad?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "AD - Chaikin A/D Line"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"ad": "2262629.83773"
}
],
"status": "ok"
}
Accumulation/distribution oscillator
/adosc
The Accumulation/Distribution Oscillator endpoint (ADOSC) calculates a momentum indicator that highlights shifts in buying or selling pressure by analyzing price and volume data over different time frames. It returns numerical values that help users identify potential trend reversals in financial markets.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

fast_period

integer
Number of periods for fast moving average. Takes values in the range from 1 to 800

Default: 12

slow_period

integer
Number of periods for slow moving average. Takes values in the range from 1 to 800

Default: 26

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/adosc?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "ADOSC - Chaikin A/D Oscillator",
"fast_period": 12,
"slow_period": 26
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"adosc": "-233315.15185"
}
],
"status": "ok"
}
On balance volume
/obv
The On Balance Volume (OBV) endpoint provides a time series of the OBV indicator, which calculates cumulative volume to reflect buying and selling pressure over time. This endpoint returns data that helps users track volume trends in relation to price movements, aiding in the identification of potential trend continuations or reversals in a security's price.

API credits cost

1 per symbol

Take note that this endpoint is applicable to all instruments except currencies.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/obv?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "OBV - On Balance Volume",
"series_type": "close"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"obv": "540374.0"
}
],
"status": "ok"
}
Relative volume
/rvol
The Relative Volume endpoint (/rvol) provides a ratio comparing a security's current trading volume to its average volume over a specified period. This data helps users detect unusual trading activity and assess the strength of price movements, offering insights into potential market breakouts.

API credits cost

1 per symbol

This API endpoint is available starting with the Grow plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 14

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/rvol?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "RVOL - Relative Volume Indicator",
"time_period": 14
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"rvol": "2.9054"
}
],
"status": "ok"
}
Volatility indicators
Quantify the range or dispersion of price over time to gauge risk, size stops, or identify breakouts (e.g. ATR, NATR, True Range) and adaptive overlays like SuperTrend.

Average true range
/atr
The Average True Range (ATR) endpoint provides data on market volatility by calculating the average range of price movement over a user-defined period. It returns numerical values representing the ATR for each time interval, allowing users to gauge the degree of price fluctuation in a financial instrument. This data is useful for setting stop-loss levels and determining optimal entry and exit points in trading strategies.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 14

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/atr?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "ATR - Average True Range",
"time_period": 14
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"atr": "0.19828"
}
],
"status": "ok"
}
Normalized average true range
/natr
The Normalized Average True Range (NATR) endpoint provides a volatility indicator that calculates the average range of price movement over a specified period, expressed as a percentage of the security's price. This data allows users to compare volatility levels across different securities easily. The endpoint returns a time series of NATR values, which can be used to assess and compare the price volatility of various financial instruments.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 14

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/natr?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "NATR - Normalized Average True Range",
"time_period": 14
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"natr": "0.09862"
}
],
"status": "ok"
}
Supertrend
/supertrend
The Supertrend endpoint provides data on the Supertrend indicator, a tool used to identify potential buy and sell signals in trending markets. It returns values that indicate the current trend direction and potential reversal points based on price, time, and volatility. Users can leverage this data to pinpoint optimal entry and exit points for trades.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

period

integer
The period used for calculation in the indicator. Takes values in the range from 1 to 800

Default: 10

multiplier

integer
The factor used to adjust the indicator's sensitivity.

Default: 3

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/supertrend?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "SUPERTREND - SuperTrend Indicator",
"period": 10,
"multiplier": 3
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"supertrend": "201.56432"
}
],
"status": "ok"
}
Supertrend Heikin Ashi candles
/supertrend_heikinashicandles
The Supertrend Heikin Ashi candles endpoint provides data combining Supertrend signals with Heikin Ashi candlestick patterns. It returns a series of data points indicating trend direction and smoothed price movements, useful for identifying potential buy or sell opportunities in trading.

API credits cost

1 per symbol

This API endpoint is available starting with the Grow plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

period

integer
The period used for calculation in the indicator. Takes values in the range from 1 to 800

Default: 10

multiplier

integer
The factor used to adjust the indicator's sensitivity.

Default: 3

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/supertrend_heikinashicandles?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "SUPERTREND_HEIKINASHICANDLES - SuperTrendHeikinAshiCandles Indicator",
"period": 10,
"multiplier": 3
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"supertrend": "201.66713",
"heikinhighs": "201.25599",
"heikinopens": "200.9825",
"heikincloses": "201.02449",
"heikinlows": "200.85199"
}
],
"status": "ok"
}
True range
/trange
The True Range (TRANGE) endpoint calculates the range of price movement for a specified period, providing a measure of market volatility. It returns data that includes the highest and lowest prices over the period, along with the closing price from the previous period. This information is useful for traders to assess market volatility and adjust their trading strategies accordingly.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/trange?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "TRANGE - True Range"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"trange": "0.404"
}
],
"status": "ok"
}
Price transform
Convert raw OHLC data into derived series or aggregated values to feed other indicators or reveal different perspectives on price (e.g. typical price, HLC3, weighted close, arithmetic transforms like SUM, AVG, LOG, SQRT).

Addition
/add
The Addition (ADD) endpoint calculates the sum of two input data series, such as technical indicators or price data, and returns the combined result. This endpoint is useful for users who need to aggregate data points to create custom indicators or analyze the combined effect of multiple data series in financial analysis.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type_1

string
Price type used as the first part of technical indicator

Supports: close, open, high, low, volume

Default: open

series_type_2

string
Price type used as the second part of technical indicator

Supports: close, open, high, low, volume

Default: close

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/add?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "ADD - Arithmetic Addition",
"series_type_1": "open",
"series_type_2": "close"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"add": "402.10798"
}
],
"status": "ok"
}
Average
/avg
The Average (AVG) endpoint calculates the arithmetic mean of a specified data series over a chosen time period. It returns a smoothed dataset that helps users identify trends by reducing short-term fluctuations. This endpoint is useful for obtaining a clearer view of data trends, particularly in time series analysis.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/avg?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "AVG - Average",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"avg": "201.53871"
}
],
"status": "ok"
}
Average price
/avgprice
The Average Price (AVGPRICE) endpoint calculates and returns the mean value of a security's open, high, low, and close prices. This endpoint provides a straightforward metric to assess the overall price level of a security over a specified period.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/avgprice?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "AVGPRICE - Average Price"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"avgprice": "201.02449"
}
],
"status": "ok"
}
Ceiling
/ceil
The Ceiling (CEIL) endpoint rounds each value in the input data series up to the nearest whole number. It returns a series where each original data point is adjusted to its ceiling value, which can be useful for precise calculations or when integrating with other technical indicators that require integer inputs.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/ceil?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "CEIL - CEIL",
"series_type": "close"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"ceil": "202.0"
}
],
"status": "ok"
}
Division
/div
The Division (DIV) endpoint calculates the result of dividing one data series by another, providing a normalized output. It is commonly used to combine or adjust multiple technical indicators or price data for comparative analysis. This endpoint returns the division results as a time series, allowing users to easily interpret and utilize the normalized data in their financial models or charts.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type_1

string
Price type used as the first part of technical indicator

Supports: close, open, high, low, volume

Default: open

series_type_2

string
Price type used as the second part of technical indicator

Supports: close, open, high, low, volume

Default: close

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/div?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "DIV - Arithmetic Division",
"series_type_1": "open",
"series_type_2": "close"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"div": "1.00201"
}
],
"status": "ok"
}
Exponential
/exp
The Exponential (EXP) Indicator endpoint computes the exponential value of a specified input, providing a numerical result that is commonly applied in complex mathematical and financial computations.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/exp?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "EXP - Exponential",
"series_type": "close"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"exp": "2.0649375034375067e+87"
}
],
"status": "ok"
}
Floor
/floor
The Floor (FLOOR) endpoint processes numerical input data by rounding each value down to the nearest integer. It returns a series of adjusted data points that can be used for further calculations or combined with other datasets. This endpoint is useful for users needing to simplify data by removing decimal precision, aiding in scenarios where integer values are required.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/floor?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "FLOOR - FLOOR",
"series_type": "close"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"floor": "201.0"
}
],
"status": "ok"
}
Heikinashi candles
/heikinashicandles
The heikinashi candles endpoint provides smoothed candlestick data by averaging price information to reduce market noise. It returns a series of Heikin Ashi candles, which include open, high, low, and close values, making it easier to identify trends and potential reversals in asset prices. This endpoint is useful for traders and analysts seeking a clearer view of market trends without the volatility present in traditional candlestick charts.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/heikinashicandles?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "HEIKINASHICANDLES - Heikin-Ashi Candles"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"heikinhighs": "201.25599",
"heikinopens": "200.9825",
"heikincloses": "201.02449",
"heikinlows": "200.85199"
}
],
"status": "ok"
}
High, low, close average
/hlc3
The High, Low, Close Average (HLC3) endpoint calculates and returns the average of a security's high, low, and close prices for a specified period. This endpoint provides a straightforward metric to assess price trends, helping users quickly identify the average price level of a security over time.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/hlc3?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "HLC3 - High, Low, Close Average Values"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"hlc3": "201.05266"
}
],
"status": "ok"
}
Natural logarithm
/ln
The Natural Logarithm (LN) endpoint computes the natural logarithm of a specified input value, returning a numerical result. This endpoint is useful for users needing to perform logarithmic transformations on data, which can be applied in various financial calculations and advanced mathematical analyses.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/ln?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "LN - Natural Logarithm to the base of constant e",
"series_type": "close"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"ln": "5.30355"
}
],
"status": "ok"
}
Base-10 logarithm
/log10
The Base-10 Logarithm (LOG10) endpoint computes the base-10 logarithm of a specified input value. It returns a numerical result that represents the power to which the number 10 must be raised to obtain the input value. This endpoint is useful for transforming data into a logarithmic scale, which can simplify the analysis of exponential growth patterns or compress large ranges of data in financial calculations.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/log10?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "LOG10 - Logarithm to base 10",
"series_type": "close"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"log10": "2.3033"
}
],
"status": "ok"
}
Median price
/medprice
The Median Price (MEDPRICE) endpoint calculates and returns the average of the high and low prices of a security for a specified period. This endpoint provides a simplified view of price movements, helping users quickly assess price trends by focusing on the midpoint of price action.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/medprice?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "MEDPRICE - Median Price"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"medprice": "201.05399"
}
],
"status": "ok"
}
Multiplication
/mult
The Multiplication (MULT) endpoint calculates the product of two input data series, returning a new data series that represents the element-wise multiplication of the inputs. This is useful for combining or adjusting technical indicators or price data to create custom metrics or to normalize values across different scales.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type_1

string
Price type used as the first part of technical indicator

Supports: close, open, high, low, volume

Default: open

series_type_2

string
Price type used as the second part of technical indicator

Supports: close, open, high, low, volume

Default: close

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/mult?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "MULT - Arithmetic Multiply",
"series_type_1": "open",
"series_type_2": "close"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"mult": "40422.66609"
}
],
"status": "ok"
}
Square root
/sqrt
The Square Root (SQRT) endpoint computes the square root of a specified numerical input. It returns a single numerical value representing the square root, which can be used in various mathematical computations or financial models requiring this specific transformation.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/sqrt?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "SQRT - Square Root",
"series_type": "close"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"sqrt": "14.17921"
}
],
"status": "ok"
}
Subtraction
/sub
The Subtraction (SUB) endpoint calculates the difference between two input data series, such as technical indicators or price data. It returns a time series of the resulting values, allowing users to compare or normalize data by highlighting the variance between the two series.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type_1

string
Price type used as the first part of technical indicator

Supports: close, open, high, low, volume

Default: open

series_type_2

string
Price type used as the second part of technical indicator

Supports: close, open, high, low, volume

Default: close

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/sub?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "SUB - Arithmetic Subtraction",
"series_type_1": "open",
"series_type_2": "close"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"sub": "0.404"
}
],
"status": "ok"
}
Summation
/sum
The Summation (SUM) endpoint calculates the cumulative total of a specified data series over a defined time period. It returns a numerical value representing the sum, which can be used to track the aggregate value of financial data, such as stock prices or trading volumes, over time. This endpoint is useful for users needing to compute the total accumulation of a dataset for further analysis or reporting.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/sum?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "SUM - Summation",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"sum": "1812.70842"
}
],
"status": "ok"
}
Typical price
/typprice
The Typical Price (TYPPRICE) endpoint calculates and returns the average of a financial instrument's high, low, and close prices for a given period. This endpoint provides a simplified metric that reflects the central tendency of price movements, useful for traders and analysts who need a straightforward view of price trends.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/typprice?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "TYPPRICE - Typical Price"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"typprice": "201.05266"
}
],
"status": "ok"
}
Weighted close price
/wclprice
The Weighted Close Price (WCLPRICE) endpoint calculates a security's average price by giving additional weight to the closing price, using the formula: (High + Low + Close \* 2) / 4.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/wclprice?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "WCLPRICE - Weighted Close Price"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"wclprice": 201.052
}
],
"status": "ok"
}
Cycle indicators
Detect and follow recurring periodic patterns in price action using Hilbert Transform–based measures of cycle period and phase (e.g. HT_SINE, HT_DCPERIOD, HT_DCPHASE, HT_PHASOR, HT_TRENDMODE).

Hilbert transform dominant cycle period
/ht_dcperiod
The Hilbert Transform Dominant Cycle Period (HT_DCPERIOD) endpoint calculates the dominant cycle length of a financial instrument's price data. It returns a numerical value representing the cycle period, which traders can use to identify prevailing market cycles and adjust their trading strategies accordingly.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/ht_dcperiod?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "HT_DCPERIOD - Hilbert Transform Dominant Cycle Period",
"series_type": "close"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"ht_dcperiod": "28.12565"
}
],
"status": "ok"
}
Hilbert transform dominant cycle phase
/ht_dcphase
The Hilbert Transform Dominant Cycle Phase (HT_DCPHASE) endpoint provides the current phase of the dominant market cycle for a given financial instrument. It returns numerical data indicating the phase angle, which can be used by traders to identify potential market entry and exit points based on cyclical patterns.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/ht_dcphase?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "HT_DCPHASE - Hilbert Transform Dominant Cycle Phase",
"series_type": "close"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"ht_dcphase": "-38.50975"
}
],
"status": "ok"
}
Hilbert transform phasor components
/ht_phasor
The Hilbert Transform Phasor Components (HT_PHASOR) endpoint analyzes a price series to return two key components: in-phase and quadrature. These components help identify cyclical patterns and the direction of trends in the data. Use this endpoint to gain precise insights into the timing and strength of market cycles, enhancing your ability to track and predict price movements.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/ht_phasor?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "HT_PHASOR - Hilbert Transform Phasor Components",
"series_type": "close"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"in_phase": "-0.56826",
"quadrature": "-0.43318"
}
],
"status": "ok"
}
Hilbert transform sine wave
/ht_sine
The Hilbert Transform Sine Wave (HT_SINE) endpoint provides sine and cosine wave components derived from the dominant market cycle. This data helps traders pinpoint potential market turning points and assess trend directions by analyzing cyclical patterns.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/ht_sine?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "HT_SINE - Hilbert Transform SineWave",
"series_type": "close"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"ht_sine": "-0.62265",
"ht_leadsine": "0.11303"
}
],
"status": "ok"
}
Hilbert transform trend vs cycle mode
/ht_trendmode
The Hilbert Transform Trend vs Cycle Mode (HT_TRENDMODE) endpoint identifies whether a market is in a trending or cyclical phase. It returns data indicating the current market phase, allowing users to adjust their trading strategies based on the prevailing conditions.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/ht_trendmode?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "HT_TRENDMODE - Hilbert Transform Trend vs Cycle Mode",
"series_type": "close"
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"ht_trendmode": "0"
}
],
"status": "ok"
}
Statistic functions
Compute fundamental statistical metrics on price series—dispersion, regression, correlation, and forecasting components—for standalone analysis or as inputs to other models (e.g. STDDEV, VAR, LINEARREG, CORREL, TSF, BETA).

Beta indicator
/beta
The Beta Indicator endpoint provides data on a security's sensitivity to market movements by comparing its price changes to a benchmark index. It returns the beta value, which quantifies the systematic risk of the security relative to the market. This information is useful for evaluating how much a security's price is expected to move in relation to market changes.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type_1

string
Price type used as the first part of technical indicator

Supports: close, open, high, low, volume

Default: open

series_type_2

string
Price type used as the second part of technical indicator

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/beta?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "BETA - Beta",
"series_type_1": "open",
"series_type_2": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"beta": "-0.05742"
}
],
"status": "ok"
}
Correlation
/correl
The Correlation (CORREL) endpoint calculates the statistical relationship between two securities over a specified time period, returning a correlation coefficient. This coefficient ranges from -1 to 1, indicating the strength and direction of their linear relationship. A value close to 1 suggests a strong positive correlation, while a value near -1 indicates a strong negative correlation. This data is useful for identifying securities that move together or in opposite directions, aiding in strategies like diversification or pairs trading.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type_1

string
Price type used as the first part of technical indicator

Supports: close, open, high, low, volume

Default: open

series_type_2

string
Price type used as the second part of technical indicator

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/correl?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "CORREL - Pearson's Correlation Coefficient",
"series_type_1": "open",
"series_type_2": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"correl": "0.93282"
}
],
"status": "ok"
}
Linear regression
/linearreg
The Linear Regression endpoint (LINEARREG) calculates the best-fit straight line through a series of financial data points. It returns the slope and intercept values of this line, allowing users to determine the overall direction of a market trend and identify potential support or resistance levels.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/linearreg?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "LINEARREG - Linear Regression",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"linearreg": "200.79327"
}
],
"status": "ok"
}
Linear regression angle
/linearregangle
The Linear Regression Angle endpoint (LINEARREGANGLE) calculates the angle of the linear regression line for a given time series of stock prices. It returns the slope of the trend line, expressed in degrees, which helps users identify the direction and steepness of a trend over a specified period. This data is useful for detecting upward or downward trends in asset prices.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/linearregangle?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "LINEARREGANGLE - Linear Regression Angle",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"linearregangle": "-8.79357"
}
],
"status": "ok"
}
Linear regression intercept
/linearregintercept
The Linear Regression Intercept endpoint (LINEARREGINTERCEPT) calculates the y-intercept of a linear regression line for a given dataset. It returns the value where the regression line crosses the y-axis, providing a numerical reference point for understanding the starting position of a trend over a specified period. This can be useful for users needing to establish baseline values in their data analysis.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/linearregintercept?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "LINEARREGINTERCEPT - Linear Regression Intercept",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"linearregintercept": "202.03082"
}
],
"status": "ok"
}
Linear regression slope
/linearregslope
The Linear Regression Slope endpoint (LINEARREGSLOPE) calculates the slope of a linear regression line for a given dataset, reflecting the rate of change in the data trend over a specified period. It returns a numerical value representing this slope, which can be used to assess the direction and strength of the trend in the dataset.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/linearregslope?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "LINEARREGSLOPE - Linear Regression Slope",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"linearregslope": "-0.15469"
}
],
"status": "ok"
}
Maximum
/max
The Maximum (MAX) endpoint calculates and returns the highest value within a specified data series over a given period. This endpoint is useful for identifying potential resistance levels or detecting extreme price movements in financial data.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/max?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "MAX - Highest value over period",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"max": "202.05"
}
],
"status": "ok"
}
Maximum Index
/maxindex
The Maximum Index (MAXINDEX) endpoint identifies the position of the highest value within a specified data series over a given time frame. It returns the index where the peak value occurs, allowing users to pinpoint when the maximum price or value was reached in the series. This is useful for tracking the timing of significant peaks in financial data.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/maxindex?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "MAXINDEX - Index of highest value over period",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"maxidx": "491"
}
],
"status": "ok"
}
Minimum
/min
The Minimum (MIN) Indicator endpoint provides the lowest value of a specified data series over a chosen time period. This endpoint is useful for identifying potential support levels or detecting extreme price movements in financial data.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/min?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "MIN - Lowest value over period",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"min": "200.935"
}
],
"status": "ok"
}
Minimum index
/minindex
The Minimum Index (MININDEX) endpoint identifies the position of the lowest value within a specified data series over a given time frame. It returns the index number corresponding to the earliest occurrence of this minimum value. This is useful for pinpointing when the lowest price or value occurred in a dataset, aiding in time-based analysis of data trends.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/minindex?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "MININDEX - Index of lowest value over period",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"minidx": "498"
}
],
"status": "ok"
}
Minimum and maximum
/minmax
The Minimum and Maximum (MINMAX) endpoint identifies the lowest and highest values within a specified time frame for a given data series. It returns these extreme values, which can be used to detect potential support and resistance levels or significant price fluctuations in the data.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/minmax?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "MINMAX - Lowest and highest values over period",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"min": "200.935",
"max": "202.05"
}
],
"status": "ok"
}
Minimum and maximum index
/minmaxindex
The Minimum and Maximum Index (MINMAXINDEX) endpoint identifies the positions of the lowest and highest values within a specified data series period. It returns indices that indicate when these extreme values occur, allowing users to pinpoint significant price changes over time.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/minmaxindex?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "MINMAXINDEX - Indexes of lowest and highest values over period",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"minidx": "498",
"maxidx": "491"
}
],
"status": "ok"
}
Standard deviation
/stddev
The Standard Deviation (STDDEV) endpoint calculates the dispersion of a financial instrument's price data from its average value. It returns a numerical value representing the volatility of the asset over a specified period. This endpoint is useful for traders and analysts to assess price variability and identify periods of high or low volatility in the market.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

sd

double
The standard deviation applied in the calculation.

Default: 2

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/stddev?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "STDDEV - Standard Deviation",
"series_type": "close",
"time_period": 9,
"sd": 2
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"stddev": "0.86613"
}
],
"status": "ok"
}
Time series forecast
/tsf
The Time Series Forecast (TSF) endpoint provides projected future price levels using linear regression analysis. It returns data that helps users identify potential support and resistance levels, as well as trend direction in a financial market. This endpoint is useful for traders seeking to anticipate price movements and adjust their strategies accordingly.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/tsf?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "TSF - Time Series Forecast",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"tsf": "200.63858"
}
],
"status": "ok"
}
Variance
/var
The Variance (VAR) endpoint calculates the statistical variance of a financial data series, providing a measure of how much the data points deviate from the average value. It returns a numerical value representing this dispersion, which can be used to assess the volatility of a security over a specified period. This information is crucial for traders and analysts who need to evaluate the risk associated with price fluctuations in the market.

API credits cost

1 per symbol

Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of the instrument. E.g. AAPL, EUR/USD, ETH/BTC, ...

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

interval

string
Interval between two consecutive points in time series

Supports: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 5h, 1day, 1week, 1month

Example: 1min

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

series_type

string
Price type on which technical indicator is calculated

Supports: close, open, high, low, volume

Default: close

time_period

integer
Number of periods to average over. Takes values in the range from 1 to 800

Default: 9

type

string
The asset class to which the instrument belongs

Supports: American Depositary Receipt, Bond, Bond Fund, Closed-end Fund, Common Stock, Depositary Receipt, Digital Currency, ETF, Exchange-Traded Note, Global Depositary Receipt, Limited Partnership, Mutual Fund, Physical Currency, Preferred Stock, REIT, Right, Structured Product, Trust, Unit, Warrant

Example: Common Stock

outputsize

integer
Number of data points to retrieve. Supports values in the range from 1 to 5000. Default 30 when no date parameters are set, otherwise set to maximum

Default: 30

format

string
The format of the response data

Supports: JSON, CSV

Default: JSON

delimiter

string
The separator used in the CSV response data

Default: ;

prepost

boolean
Returns quotes that include pre-market and post-market data. Only for Pro and above plans. Available at the 1min, 5min, 15min, and 30min intervals for US equities. Open, high, low, close values are supplied without volume

Default: false

dp

integer
Specifies the number of decimal places for floating values. Should be in range [0, 11] inclusive. By default, the number of decimal places is automatically determined based on the values provided

Default: -1

order

string
Sorting order of the output

Supports: asc, desc

Default: desc

include_ohlc

boolean
Specify if OHLC values should be added in the output

Supports: true, false

Default: false

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. Exchange for local exchange time
2. UTC for datetime at universal UTC standard
3. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here
   Take note that the IANA Timezone name is case-sensitive
   Default: Exchange

date

string
Specifies the exact date to get the data for. Could be the exact date, e.g. 2021-10-27, or in human language today or yesterday

Example: 2021-10-27

start_date

string
Can be used separately and together with end_date. Format 2006-01-02 or 2006-01-02T15:04:05

Default location:

Forex and Cryptocurrencies - UTC
Stocks - where exchange is located (e.g. for AAPL it will be America/New_York)
Both parameters take into account if timezone parameter is provided.
If timezone is given then, start_date and end_date will be used in the specified location
Examples:

1. &symbol=AAPL&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 New York time up to current date
2. &symbol=EUR/USD&timezone=Asia/Singapore&start_date=2019-08-09T15:50:00&…
   Returns all records starting from 2019-08-09T15:50:00 Singapore time up to current date
3. &symbol=ETH/BTC&timezone=Europe/Zurich&start_date=2019-08-09T15:50:00&end_date=2019-08-09T15:55:00&...
   Returns all records starting from 2019-08-09T15:50:00 Zurich time up to 2019-08-09T15:55:00
   Example: 2024-08-22T15:04:05

end_date

string
The ending date and time for data selection, see start_date description for details.

Example: 2024-08-22T16:04:05

previous_close

boolean
A boolean parameter to include the previous closing price in the time_series data. If true, adds previous bar close price value to the current object

Default: false

adjust

string
Adjusting mode for prices

Supports: all, splits, dividends, none

Default: splits

Request example

https://api.twelvedata.com/var?symbol=AAPL&interval=1min&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"interval": "1min",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"type": "Common Stock",
"indicator": {
"name": "VAR - Variance",
"series_type": "close",
"time_period": 9
}
},
"values": [
{
"datetime": "2019-08-09 15:59:00",
"var": "0.18755"
}
],
"status": "ok"
}
Analysis
Forward-looking and consensus analytics—earnings and revenue estimates, EPS trends and revisions, growth projections, analyst recommendations and ratings, price targets, and other consensus metrics. Perfect for incorporating expert forecasts and sentiment into your models and dashboards.

Earnings estimate
Useful
/earnings_estimate
The earnings estimate endpoint provides access to analysts' projected earnings per share (EPS) for a specific company, covering both upcoming quarterly and annual periods. This data is crucial for users who need to track and compare expected financial performance across different timeframes, aiding in the evaluation of a company's future profitability.

API credits cost

20 per symbol

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
Filter by symbol

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

exchange

string
Exchange where instrument is traded

Example: NASDAQ

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

Request example

https://api.twelvedata.com/earnings_estimate?symbol=AAPL&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"name": "Apple Inc",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNGS",
"type": "Common Stock"
},
"earnings_estimate": [
{
"date": "2022-09-30",
"period": "current_quarter",
"number_of_analysts": 27,
"avg_estimate": 1.26,
"low_estimate": 1.13,
"high_estimate": 1.35,
"year_ago_eps": 1.24
}
],
"status": "ok"
}
Revenue estimate
/revenue_estimate
The revenue estimate endpoint provides a company's projected quarterly and annual revenue figures based on analysts' estimates. This data is useful for users seeking insights into expected company performance, allowing them to compare forecasted sales with historical data or other companies' estimates.

API credits cost

20 per symbol

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
Filter by symbol

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

exchange

string
Filter by exchange name

Example: NASDAQ

dp

integer
Number of decimal places for floating values. Should be in range [0,11] inclusive

Default: 5

Request example

https://api.twelvedata.com/revenue_estimate?symbol=AAPL&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"name": "Apple Inc",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNGS",
"type": "Common Stock"
},
"revenue_estimate": [
{
"date": "2022-09-30",
"period": "current_quarter",
"number_of_analysts": 24,
"avg_estimate": 88631500000,
"low_estimate": 85144300000,
"high_estimate": 92794900000,
"year_ago_sales": 83360000000,
"sales_growth": 0.06
}
],
"status": "ok"
}
EPS trend
/eps_trend
The EPS trend endpoint provides detailed historical data on Earnings Per Share (EPS) trends over specified periods. It returns a comprehensive breakdown of estimated EPS changes, allowing users to track and analyze the progression of a company's earnings performance over time. This endpoint is ideal for users seeking to understand historical EPS fluctuations and assess financial growth patterns.

API credits cost

20 per symbol

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
Filter by symbol

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

exchange

string
Filter by exchange name

Example: NASDAQ

Request example

https://api.twelvedata.com/eps_trend?symbol=AAPL&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"name": "Apple Inc",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNGS",
"type": "Common Stock"
},
"eps_trend": [
{
"date": "2022-09-30",
"period": "current_quarter",
"current_estimate": 1.26,
"7_days_ago": 1.26,
"30_days_ago": 1.31,
"60_days_ago": 1.32,
"90_days_ago": 1.33
}
],
"status": "ok"
}
EPS revisions
/eps_revisions
The EPS revisions endpoint provides updated analyst forecasts for a company's earnings per share (EPS) on both a quarterly and annual basis. It delivers data on how these EPS predictions have changed over the past week and month, allowing users to track recent adjustments in analyst expectations. This endpoint is useful for monitoring shifts in market sentiment regarding a company's financial performance.

API credits cost

20 per symbol

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
Filter by symbol

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

exchange

string
Filter by exchange name

Example: NASDAQ

Request example

https://api.twelvedata.com/eps_revisions?symbol=AAPL&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"name": "Apple Inc",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNGS",
"type": "Common Stock"
},
"eps_revision": [
{
"date": "2022-09-30",
"period": "current_quarter",
"up_last_week": 1,
"up_last_month": 5,
"down_last_week": 0,
"down_last_month": 0
}
],
"status": "ok"
}
Growth estimates
/growth_estimates
The growth estimates endpoint provides consensus analyst projections on a company's growth rates over various timeframes. It aggregates and averages estimates from multiple analysts, focusing on key financial metrics such as earnings per share and revenue. This endpoint is useful for obtaining a comprehensive view of expected company performance based on expert analysis.

API credits cost

20 per symbol

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
Filter by symbol

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

exchange

string
Exchange where instrument is traded

Example: NASDAQ

Request example

https://api.twelvedata.com/growth_estimates?symbol=AAPL&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"name": "Apple Inc",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNGS",
"type": "Common Stock"
},
"growth_estimates": {
"current_quarter": 0.016,
"next_quarter": 0.01,
"current_year": 0.087,
"next_year": 0.055999998,
"next_5_years_pa": 0.094799995,
"past_5_years_pa": 0.23867
},
"status": "ok"
}
Recommendations
High demand
/recommendations
The recommendations endpoint provides a summary of analyst opinions for a specific stock, delivering an average recommendation categorized as Strong Buy, Buy, Hold, or Sell. It also includes a numerical recommendation score, offering a quick overview of market sentiment based on expert analysis.

API credits cost

100 per symbol

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
Filter by symbol

Example: AAPL

figi

string
The FIGI of an instrument for which data is requested

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

country

string
The country where the instrument is traded, e.g., United States or US

Example: United States

exchange

string
The exchange name where the instrument is traded, e.g., Nasdaq, NSE.

Example: NASDAQ

Request example

https://api.twelvedata.com/recommendations?symbol=AAPL&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"name": "Apple Inc",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNGS",
"type": "Common Stock"
},
"trends": {
"current_month": {
"strong_buy": 13,
"buy": 20,
"hold": 8,
"sell": 0,
"strong_sell": 0
},
"previous_month": {
"strong_buy": 13,
"buy": 20,
"hold": 8,
"sell": 0,
"strong_sell": 0
},
"2_months_ago": {
"strong_buy": 13,
"buy": 20,
"hold": 8,
"sell": 0,
"strong_sell": 0
},
"3_months_ago": {
"strong_buy": 13,
"buy": 20,
"hold": 8,
"sell": 0,
"strong_sell": 0
}
},
"rating": 8.2,
"status": "ok"
}
Price target
High demand
/price_target
The price target endpoint provides detailed projections of a security's future price as estimated by financial analysts. It returns data including the high, low, and average price targets. This endpoint is useful for users seeking to understand potential future valuations of specific securities based on expert analysis.

API credits cost

75 per symbol

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
Filter by symbol

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

exchange

string
Filter by exchange name

Example: NASDAQ

Request example

https://api.twelvedata.com/price_target?symbol=AAPL&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"name": "Apple Inc",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNGS",
"type": "Common Stock"
},
"price_target": {
"high": 220,
"median": 185,
"low": 136,
"average": 184.01,
"current": 169.5672,
"currency": "USD"
},
"status": "ok"
}
Analyst ratings snapshot
/analyst_ratings/light
The analyst ratings snapshot endpoint provides a streamlined summary of ratings from analyst firms for both US and international markets. It delivers essential data on analyst recommendations, including buy, hold, and sell ratings, allowing users to quickly assess the general sentiment of analysts towards a particular stock.

API credits cost

75 per symbol

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
Filter by symbol

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

exchange

string
Filter by exchange name

Example: NASDAQ

rating_change

string
Filter by rating change action

Supports: Maintains, Upgrade, Downgrade, Initiates, Reiterates

outputsize

integer
Number of records in response

Default: 30

Request example

https://api.twelvedata.com/analyst_ratings/light?symbol=AAPL&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"name": "Apple Inc",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNGS",
"type": "Common Stock"
},
"ratings": [
{
"date": "2022-08-19",
"firm": "Keybanc",
"rating_change": "Maintains",
"rating_current": "Overweight",
"rating_prior": "Overweight"
}
],
"status": "ok"
}
Analyst ratings US equities
/analyst_ratings/us_equities
The analyst ratings US equities endpoint provides detailed information on analyst ratings for U.S. stocks. It returns data on the latest ratings issued by various analyst firms, including the rating itself, the firm issuing the rating, and any changes in the rating. This endpoint is useful for users tracking analyst opinions on U.S. equities, allowing them to see how professional analysts view the potential performance of specific stocks.

API credits cost

200 per symbol

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
Filter by symbol

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

exchange

string
Filter by exchange name

Example: NASDAQ

rating_change

string
Filter by rating change action

Supports: Maintains, Upgrade, Downgrade, Initiates, Reiterates

outputsize

integer
Number of records in response

Default: 30

Request example

https://api.twelvedata.com/analyst_ratings/us_equities?symbol=AAPL&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"name": "Apple Inc",
"currency": "USD",
"exchange_timezone": "America/New_York",
"exchange": "NASDAQ",
"mic_code": "XNGS",
"type": "Common Stock"
},
"ratings": [
{
"date": "2022-08-19",
"firm": "Keybanc",
"analyst_name": "Brandon Nispel",
"rating_change": "Maintains",
"rating_current": "Overweight",
"rating_prior": "Overweight",
"time": "08:29:48",
"action_price_target": "Raises",
"price_target_current": 185.14,
"price_target_prior": 177.01
}
],
"status": "ok"
}
Regulatory
Compliance and filings data: insider transactions, SEC reports, governance documents, and more. Critical for audit trails, due-diligence workflows, and risk-management integrations.

EDGAR fillings
New
/edgar_filings/archive
The EDGAR fillings endpoint provides access to a comprehensive collection of financial documents submitted to the SEC, including real-time and historical forms, filings, and exhibits. Users can retrieve detailed information about company disclosures, financial statements, and regulatory submissions, enabling them to access essential compliance and financial data directly from the SEC's EDGAR system.

API credits cost

50 per request

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
The ticker symbol of an instrument for which data is requested

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

exchange

string
Filter by exchange name

Example: NASDAQ

mic_code

string
Filter by market identifier code (MIC) under ISO 10383 standard

Example: XNGS

country

string
Filter by country name or alpha code, e.g., United States or US

Example: United States

form_type

string
Filter by form types, example 8-K, EX-1.1

Example: 8-K

filled_from

string
Filter by filled time from

Example: 2024-01-01

filled_to

string
Filter by filled time to

Example: 2024-01-01

page

integer
Page number

Default: 1

page_size

integer
Number of records in response

Default: 10

Request example

https://api.twelvedata.com/edgar_filings/archive?symbol=AAPL&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"exchange": "NASDAQ",
"mic_code": "XNGS",
"type": "Common Stock"
},
"values": [
{
"cik": 1711463,
"filed_at": 1726617600,
"files": [
{
"name": "primary_doc.html",
"size": 2980,
"type": "144",
"url": "https://www.sec.gov/Archives/edgar/data/1711463/000197185724000581/primary_doc.xml"
}
],
"filing_url": "https://www.sec.gov/Archives/edgar/data/1711463/0001971857-24-000581-index.htm",
"form_type": "144",
"ticker": [
"AAPL"
]
}
]
}
Insider transaction
/insider_transactions
The insider transaction endpoint provides detailed data on trades executed by company insiders, such as executives and directors. It returns information including the insider's name, their role, the transaction type, the number of shares, the transaction date, and the price per share. This endpoint is useful for tracking insider activity and understanding potential insider sentiment towards a company's stock.

API credits cost

200 per symbol

This API endpoint is available starting with the Pro plan.
Parameters
Response
One of these parameters is required
symbol

string
The ticker symbol of an instrument for which data is requested, e.g., AAPL, TSLA. For preffered stocks use dot(.) delimiter. E.g. BRK.A or BRK.B will be correct

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

exchange

string
Exchange where instrument is traded, e.g., Nasdaq, NSE

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
Country where instrument is traded, e.g., United States or US.

Example: United States

Request example

https://api.twelvedata.com/insider_transactions?symbol=AAPL&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"name": "Apple Inc",
"currency": "USD",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"exchange_timezone": "America/New_York"
},
"insider_transactions": [
{
"full_name": "ADAMS KATHERINE L",
"position": "General Counsel",
"date_reported": "2021-05-03",
"is_direct": true,
"shares": 17000,
"value": 2257631,
"description": "Sale at price 132.57 - 133.93 per share."
}
]
}
Institutional holders
/institutional_holders
The institutional holders endpoint provides detailed information on the percentage and amount of a company's stock owned by institutional investors, such as pension funds, insurance companies, and investment firms. This data is essential for understanding the influence and involvement of large entities in a company's ownership structure.

API credits cost

1500 per symbol

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of instrument. For preffered stocks use dot(.) delimiter. E.g. BRK.A or BRK.B will be correct

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
Country where instrument is traded, e.g., United States or US

Example: United States

Request example

https://api.twelvedata.com/institutional_holders?symbol=AAPL&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"name": "Apple Inc",
"currency": "USD",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"exchange_timezone": "America/New_York"
},
"institutional_holders": [
{
"entity_name": "Vanguard Group, Inc. (The)",
"date_reported": "2021-06-30",
"shares": 1264936543,
"value": 173245708929,
"percent_held": 0.0765
}
]
}
Fund holders
/fund_holders
The fund holders endpoint provides detailed information about the proportion of a company's stock that is owned by mutual fund holders. It returns data on the number of shares held, the percentage of total shares outstanding, and the names of the mutual funds involved. This endpoint is useful for users looking to understand mutual fund investment in a specific company.

API credits cost

1500 per symbol

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of instrument. For preffered stocks use dot(.) delimiter. E.g. BRK.A or BRK.B will be correct

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
Country where instrument is traded, e.g., United States or US

Example: United States

Request example

https://api.twelvedata.com/fund_holders?symbol=AAPL&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"name": "Apple Inc",
"currency": "USD",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"exchange_timezone": "America/New_York"
},
"fund_holders": [
{
"entity_name": "Vanguard Group, Inc. (The)",
"date_reported": "2021-06-30",
"shares": 1264936543,
"value": 173245708929,
"percent_held": 0.0765
}
]
}
Direct holders
New
/direct_holders
The direct holders endpoint provides detailed information about the number of shares directly held by individuals or entities as recorded in a company's official share registry. This data is essential for understanding the distribution of stock ownership within a company, helping users identify major shareholders and assess shareholder concentration.

API credits cost

1500 per symbol

This API endpoint is available starting with the Ultra plan and currently working in beta for the Tadawul exchange.
Parameters
Response
One of these parameters is required
symbol

string
Symbol ticker of instrument. For preffered stocks use dot(.) delimiter. E.g. BRK.A or BRK.B will be correct

Example: AAPL

figi

string
Filter by financial instrument global identifier (FIGI)

Example: BBG01293F5X4

isin

string
Filter by international securities identification number (ISIN)

Example: US0378331005

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

exchange

string
Exchange where instrument is traded

Example: NASDAQ

mic_code

string
Market Identifier Code (MIC) under ISO 10383 standard

Example: XNAS

country

string
Country where instrument is traded, e.g., United States or US

Example: United States

Request example

https://api.twelvedata.com/direct_holders?symbol=AAPL&apikey=demo
Response

{
"meta": {
"symbol": "AAPL",
"name": "Apple Inc",
"currency": "USD",
"exchange": "NASDAQ",
"mic_code": "XNAS",
"exchange_timezone": "America/New_York"
},
"direct_holders": [
{
"entity_name": "Vanguard Group, Inc. (The)",
"date_reported": "2021-06-30",
"shares": 1264936543,
"value": 173245708929,
"percent_held": 0.0765
}
]
}
Tax information
/tax_info
The tax information endpoint provides detailed tax-related data for a specified financial instrument, including applicable tax rates and relevant tax codes. This information is essential for users needing to understand the tax implications associated with trading or investing in specific instruments.

API credits cost

50 per symbol

This API endpoint is available starting with the Ultra plan.
Parameters
Response
One of these parameters is required
symbol

string
The ticker symbol of an instrument for which data is requested, e.g., SKYQ, AIRE, ALM:BME, HSI:HKEX.

Example: SKYQ

figi

string
The FIGI of an instrument for which data is requested

Example: BBG019XJT9D6

cusip

string
The CUSIP of an instrument for which data is requested. CUSIP access is activating in the Add-ons section

Example: 594918104

isin

string
The ISIN of an instrument for which data is requested

Example: US5949181045

exchange

string
The exchange name where the instrument is traded, e.g., Nasdaq, Euronext

Example: Nasdaq

mic_code

string
The Market Identifier Code (MIC) of the exchange where the instrument is traded, e.g., XNAS, XLON

Example: XNAS

Request example

https://api.twelvedata.com/tax_info?symbol=SKYQ&apikey=demo
Response

{
"meta": {
"symbol": "SKYQ",
"name": "Sky Quarry Inc.",
"exchange": "NASDAQ",
"mic_code": "XNCM",
"country": "United States"
},
"data": {
"tax_indicator": "us_1446f"
},
"status": "ok"
}
Sanctioned entities
New
/sanctions/{source}
The sanctions entities endpoint provides a comprehensive list of entities sanctioned by a specified authority, such as OFAC, UK, EU, or AU. Users can retrieve detailed information about individuals, organizations, and other entities subject to sanctions from the chosen source, facilitating compliance and risk management processes.

API credits cost

50 per request

This API endpoint is available starting with the Ultra plan.
Parameters
Response
source

string
Sanctions source

Supports: ofac, uk, eu, au

Example: ofac

Request example

https://api.twelvedata.com/sanctions/ofac?apikey=demo
Response

{
"sanctions": [
{
"symbol": "LOKESHMACH",
"name": "Lokesh Machines Ltd.",
"mic_code": "NSE",
"country": "India",
"sanction": {
"source": "ofac",
"program": "RUSSIA-EO14024",
"notes": "Block",
"lists": [
{
"name": "SDN List",
"published_at": "2024-10-30"
}
]
}
}
],
"count": 143,
"status": "ok"
}
Advanced
High-throughput and management endpoints for power users—submit and monitor batch jobs to pull large datasets asynchronously, track your API usage and quotas programmatically, and access other developer-focused tools for automating and scaling your data workflows.

Batches
Useful
/batch
The batch request endpoint allows users to request data for multiple financial instruments, time intervals, and data types simultaneously. This endpoint is useful for efficiently gathering diverse financial data in a single operation, reducing the need for multiple individual requests. Errors in specific requests do not affect the processing of others, and each error is reported separately, enabling easy troubleshooting.

Request body
Only JSON POST requests are supported. The request content structure consists of key-value items. The key is a unique request ID. The value is requested url.

Response
The response contains key-value data. The key is a unique request ID. The value is returned data.

API credits
The number of concurrent requests is limited by your subscription plan.
Credits are consumed per requested endpoint, with the total usage equal to the sum of individual requests in the batch.
If the requested data exceeds your available credits, only partial data will be returned asynchronously until your quota is exhausted.
If one or more requests in the batch contain errors (e.g., invalid symbols or unsupported intervals), it will not affect the successful processing of other requests. Errors are reported individually within the response, allowing you to identify and correct specific issues without impacting the entire batch.
Parameters
Response
No parameters are required
Request example

curl --location 'https://api.twelvedata.com/batch' \
--header 'Content-Type: application/json' \
--header 'Authorization: apikey demo' \
--data @- << EOF
{
"req_1": {
"url": "/time_series?symbol=AAPL&interval=1min&apikey=demo&outputsize=2"
},
"req_2": {
"url": "/exchange_rate?symbol=USD/JPY&apikey=demo"
},
"req_3": {
"url": "/currency_conversion?symbol=USD/JPY&amount=122&apikey=demo"
}
}
EOF
Response

{
"code": 200,
"status": "success",
"data": {
"req_1": {
"response": {
"meta": {
"currency": "USD",
"exchange": "NASDAQ",
"exchange_timezone": "America/New_York",
"interval": "1min",
"mic_code": "XNGS",
"symbol": "AAPL",
"type": "Common Stock"
},
"status": "ok",
"values": [
{
"close": "248.6",
"datetime": "2025-02-21 12:51:00",
"high": "248.6",
"low": "248.4",
"open": "248.5",
"volume": "22290"
},
{
"close": "248.52",
"datetime": "2025-02-21 12:50:00",
"high": "248.59",
"low": "248.43",
"open": "248.52",
"volume": "64085"
}
]
},
"status": "success"
},
"req_2": {
"response": {
"rate": 149.25999,
"symbol": "USD/JPY",
"timestamp": 1740160260
},
"status": "success"
},
"req_3": {
"response": {
"amount": 18209.71933,
"rate": 149.25999,
"symbol": "USD/JPY",
"timestamp": 1740160260
},
"status": "success"
}
}
}
API usage
/api_usage
The API Usage endpoint provides detailed information on your current API usage statistics. It returns data such as the number of requests made, remaining requests, and the reset time for your usage limits. This endpoint is essential for monitoring and managing your API consumption to ensure you stay within your allocated limits.

API credits cost

1 per request

Parameters
Response
format

string
Output format

Supports: JSON, CSV

Default: JSON

delimiter

string
Specify the delimiter used when downloading the CSV file

Default: ;

timezone

string
Timezone at which output datetime will be displayed. Supports:

1. UTC for datetime at universal UTC standard
2. Timezone name according to the IANA Time Zone Database. E.g. America/New_York, Asia/Singapore. Full list of timezones can be found here.
   Take note that the IANA Timezone name is case-sensitive
   Default: UTC

Request example

https://api.twelvedata.com/api_usage?apikey=demo
Response

{
"timestamp": "2025-05-07 11:10:12",
"current_usage": 4003,
"plan_limit": 20000,
"plan_category": "enterprise"
}
WebSocket
WebSocket will automatically send the data to you once a new piece of data is available on the exchange. In the beginning, you need to establish a connection between the server and the client. Then all data is controlled by sending event messages to the server. WebSocket is opposed to the API, where the data has to be explicitly requested from the server.

Overview
You may use the API key to connect to the Twelve Data Distributed WebSocket System (TDDWS). This system will manage all your requests to all available instruments across different exchanges. You can establish up to 3 connections (typically used in production, stage, and local environments) across the whole lifespan of the application; if you open more, the previous connections will be closed.

You may subscribe to all symbols available at Twelve Data; meanwhile, the format remains the same as the API unless there are constraints in the endpoint. Moreover, you may combine symbols across different types, and TDDWS will manage the routing. There are some limitations, though:

Server limits to receive up to 100 events from the client-side. This constraint does not affect the number of messages sent from the server to the client.
There is no limit on the number of input symbols; however, the size of the input message can not exceed 1 MB.
Please note that full access to WebSocket is available for the users on the Pro plan and above. However, testing can be done on the Basic and Grow tier plans with only one connection and up to 8 simultaneous symbols subscriptions among the permitted list.

Resources
You can try out streaming via WebSocket Playground located in the personal dashboard. On Basic and Grow plans, only trial symbols can be used; on Pro plan and above, any instrument can be streamed.

Trial symbols

WebSocket FAQ

How to stream data tutorial

Connect & Authorize

# Pass API key as connection parameter

wss://ws.twelvedata.com/v1/{$route}?apikey=your_api_key

# Or pass API key separately in header

wss://ws.twelvedata.com/v1/{$route}
X-TD-APIKEY: your_api_key
Real-time price
Useful
wss://ws.twelvedata.com/v1/quotes/price?apikey=your_api_key
This method allows you to get real-time price streaming from the exchange. Equities also have day volume information.

WebSocket credits cost

1 per symbol , API credits are not used

Response
There are two general return event types: status and price.

Status events return the information about the events itself, which symbols were successfully subscribed/unsubscribed, etc.

Price events return the real-time tick prices for particular instruments. The body will include the meta information, UNIX timestamp, and the price itself. Price events return the real-time tick prices, with the following structure:

Field* Description
event type of event
symbol symbol ticker of instrument
type general instrument type
timestamp timestamp in UNIX format
price real-time price for the underlying instrument
day_volume volume of the instrument for the current trading day
*Some additional meta response field will be received, depending on the class of the instrument.

Further steps
At this stage you might decide that you no longer want to be subscribed for particular symbols, therefore you have two options:

Manually unsubscribe from symbols. This is done with the same format as the subscription, but with action set to "action": "unsubscribe".
Reset subscription. This will reset your current connection from all subscriptions.
Send the {"action": "reset"} event.
We also recommend sending {"action": "heartbeat"} events to the server every 10 seconds or so. This will make sure to keep your connection stable.

Subscribe to multiple symbols

# You may subscribe to multiple symbols by

# calling subscribe action. Additionally,

# you can pass the exchange name after

# the colon(:).

{
"action": "subscribe",
"params": {
"symbols": "AAPL,RY,RY:TSX,EUR/USD,BTC/USD"
}
}
Subscribe using extended format

# Alternatively, if you need to get data from the

# ambiguos symbol you may use the extended format

{ "action": "subscribe",
"params": {
"symbols": [{
"symbol": "AAPL",
"exchange": "NASDAQ"
}, {
"symbol": "RY",
"mic_code": "XNYS"
}, {
"symbol": "EUR/USD",
"type": "Forex"
}
]}}
Success subscription

{
"event": "subscribe-status",
"status": "ok",
"success": [
{
"symbol":"AAPL","exchange":"NASDAQ",
"country":"United States",
"type":"Common Stock"
},
{
"symbol":"RY","exchange":"NYSE",
"country":"United States",
"type":"Common Stock"
},
{
"symbol":"RY","exchange":"TSX",
"country":"Canada",
"type":"Common Stock"
},
{
"symbol":"EUR/USD","exchange":"FOREX",
"country":"",
"type":"Physical Currency"
},
{
"symbol":"BTC/USD","exchange":"FOREX",
"country":"",
"type":"Physical Currency"
}
],
"fails": []
}
Price event data response

{
"event": "price",
"symbol": "AAPL",
"currency": "USD",
"exchange": "NASDAQ",
"type": "Common Stock",
"timestamp": 1592249566,
"price": 342.0157,
"day_volume": 27631112
}
Bid/Ask data response (where available)

{
"event": "price",
"symbol": "XAU/USD",
"currency": "USD",
"currency_base": "Gold Spot",
"currency_quote": "US Dollar",
"type": "Physical Currency",
"timestamp": 1647950462,
"price": 1925.18,
"bid": 1925.05,
"ask": 1925.32
}
Artificial Intelligence
Data Assistant
Twelve Data Assistant is implemented as a custom GPT and is available on the ChatGPT Marketplace. It provides natural language access to the full capabilities of the Twelve Data API and is designed for traders, investors, analysts, and developers. Key capabilities:

Instantly provides current prices, market snapshots, and historical data
Interprets technical indicators to identify trends, momentum, and signals
Analyzes company fundamentals, financial health, and earnings performance
Delivers valuation insights, dividend history, and analyst sentiment
Supports asset comparisons across timeframes and financial metrics
Assists developers by explaining data structures, building queries, and offering integration help
Breaks down complex queries into sequential, data-backed answers
The assistant responds in clear, plain language and delivers structured financial insights using real-time and historical data.

👉 Access it here: Twelve Data Assistant on ChatGPT

MCP server
Twelve Data MCP Server

GitHub: https://github.com/twelvedata/mcp

The Twelve Data MCP Server is an open-source connector that enables applications and AI assistants to access Twelve Data’s real-time and historical market data using the Model Context Protocol (MCP).

Its primary purpose is to bridge the Twelve Data API with tools and AI platforms that support the MCP standard. This allows users to easily fetch quotes, time series data, and instrument information for stocks, forex, and cryptocurrencies in a consistent format.

Typical use cases:

Connecting Twelve Data to AI assistants or desktop clients that support MCP
Automating market data access for analysis, dashboards, or bots
Enabling developers to use Twelve Data as a unified backend for financial data
The server can be installed and run locally or remotely, configured with your Twelve Data API key, and used as a backend for any MCP-compatible client.
For supported clients, see the official list here: https://modelcontextprotocol.io/clients
