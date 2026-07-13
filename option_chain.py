import requests
import pandas as pd
from datetime import datetime, time, timedelta
from tkinter import *
from tkinter import ttk
from tkinter import filedialog, messagebox

class OptionChain:

    # URL endpoints
    __main_url = "https://www.nseindia.com"
    __contract_info = "/api/option-chain-contract-info?symbol=NIFTY"
    __option_chain = f"/api/option-chain-v3?type=Indices&symbol=NIFTY"

    def __init__(self):
        self.data = []

        # self.TEST_MODE = False
        # if self.TEST_MODE:
        #     self.market_open = (datetime.now() + timedelta(seconds=5))
        #     self.market_close = (datetime.now() + timedelta(seconds=22))
        # else:
        #     self.market_open = datetime.combine(datetime.today().date(), time(9, 17))
        #     self.market_closed = datetime.combine(datetime.today().date(), time(15, 32))

        self.session = requests.Session()
        self.headers = {
            'User-Agent': "Mozilla/5.0 (Linux; Android 15; Pixel 9), AppleWebKit/537.36 (KHTML, like Gecko), Chrome/149.0.0.0 Mobile Safari/537.36",
            'Content-Type': "application/json; charset=UTF-8"
        }
        response = self.session.get(url=self.__main_url, headers=self.headers, timeout=10)
        self.cookies = dict(response.cookies)
        self.nearest_expiry = self.get_nearest_expiry()[0]

    
    def is_market_open(self):
        now = datetime.now()

        market_open = datetime.combine(datetime.today().date(), time(9, 17))
        market_close = datetime.combine(datetime.today().date(), time(15, 32))
        # Weekend
        if now.weekday() >= 5:
            next_day = now.date()

            while next_day.weekday() >= 5:
                next_day += timedelta(days=1)

            next_open = datetime.combine(
                next_day,
                market_open.time()
            )

            return "PRE_MARKET", next_open


        # Before market
        if now < market_open:
            next_open = datetime.combine(now.date(), market_open.time())
            return "PRE_MARKET", next_open

        # Market open
        if market_open <= now <= market_close:
            return "OPEN", None

        # After market till midnight
        next_day = now.date() + timedelta(days=1)

        while next_day.weekday() >= 5:
            next_day += timedelta(days=1)

        next_open = datetime.combine(next_day, market_open.time())
        # next_open = market_open + timedelta(days=1)
        return "POST_MARKET", next_open

    def get_nearest_expiry(self):
        url = f"{self.__main_url}{self.__contract_info}"
        response = self.session.get(url=url, headers=self.headers, timeout=10, cookies=self.cookies)
        data = response.json()
        nearest_expiry = data['expiryDates']
        return nearest_expiry
    
    def get_option_data(self):
        total_ce_oi = 0
        total_pe_oi = 0
        total_ce_change_oi = 0
        total_pe_change_oi = 0

        url = f"{self.__main_url}{self.__option_chain}&expiry={self.nearest_expiry}"
        response = self.session.get(url=url, headers=self.headers, timeout=10, cookies=self.cookies)
        data = response.json()

        for strike in data["records"]["data"]:
            total_ce_oi += strike.get("CE", {}).get("openInterest", 0) or 0
            total_pe_oi += strike.get("PE", {}).get("openInterest", 0) or 0
            total_ce_change_oi += strike.get("CE", {}).get("changeinOpenInterest", 0) or 0
            total_pe_change_oi += strike.get("PE", {}).get("changeinOpenInterest", 0) or 0


        return (total_ce_oi, total_pe_oi, total_ce_change_oi, total_pe_change_oi)
    
    def save_to_excel(self):
        if not self.data:
            messagebox.showwarning("No Data", "No data available to save")
            return "nodata"
        
        filename = filedialog.asksaveasfilename(
            defaultextension=".xlsx",
            filetypes=[("Excel Files", "*.xlsx")],
            initialfile=f"Option_Chain_Data_{datetime.now().strftime("%Y-%m-%d")}.xlsx"
        )

        if not filename:
            return "cancelled"
        
        columns = [
            "Timestamp",
            "Total CE OI",
            "Total PE OI",
            "Total CE Change",
            "Total PE Change"
        ]

        df = pd.DataFrame(self.data, columns=columns)
        df.to_excel(filename, index=False)

        messagebox.showinfo("Success", f"Data saved successfully.\n\n{filename}")

        return "saved"
