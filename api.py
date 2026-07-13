from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import threading
import time
import pandas as pd
from option_chain import OptionChain

app = FastAPI(
      title="NIFTY Option Chain API",
    version="1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # Change later to your React URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

option_chain = OptionChain()

logging = False


def collect_data():
    global logging

    while logging:

        status, _ = option_chain.is_market_open()

        if status == "OPEN":

            try:
                option_data = option_chain.get_option_data()

                row = (
                    datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    *option_data
                )

                option_chain.data.append(row)

                print("Logged:", row)

            except Exception as e:
                print(e)

        # 15 minutes
        time.sleep(900)

@app.get("/")
def home():
    return {"message": "The API is working"}

@app.get("/market-status")
def market_status():

    status, next_open = option_chain.is_market_open()

    return {
        "status": status,
        "next_open": next_open
    }

@app.get("/option-chain")
def option_chain_data():

    data = option_chain.get_option_data()

    return {
        "timestamp": datetime.now(),
        "ce_oi": data[0],
        "pe_oi": data[1],
        "ce_change": data[2],
        "pe_change": data[3]
    }

@app.get("/history")
def history():
    return option_chain.data

@app.post("/start")
def start_logging():

    global logging

    if not logging:
        logging = True

        threading.Thread(
            target=collect_data,
            daemon=True
        ).start()

    return {
        "message": "Logging Started"
    }


@app.post("/stop")
def stop_logging():

    global logging

    logging = False

    return {
        "message": "Logging Stopped"
    }


@app.get("/download")
def download():
    columns = [
        "Timestamp",
        "Total CE OI",
        "Total PE OI",
        "Total CE Change",
        "Total PE Change"
    ]

    df = pd.DataFrame(option_chain.data, columns=columns)

    filename = "option_chain_data.xlsx"
    df.to_excel(filename, index=False)

    return FileResponse(
        path=filename,
        filename="Option_Chain_Data.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )