import sys
import json
import casparser
from datetime import date, datetime
from decimal import Decimal

class CASDataEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)

def parse_cas(file_path, password):
    try:
        # read_cas_pdf in 0.8.x returns a CASSummary object (Pydantic model)
        data = casparser.read_cas_pdf(file_path, password)
        
        # Convert Pydantic model to dict
        if hasattr(data, "model_dump"):
            data_dict = data.model_dump()
        elif hasattr(data, "dict"):
            data_dict = data.dict()
        else:
            data_dict = data

        # Ensure we have a consistent structure for the SyncService
        # SyncService expects folios and investor_info
        if "investor_info" not in data_dict and "investor" in data_dict:
            data_dict["investor_info"] = data_dict["investor"]

        print(json.dumps(data_dict, cls=CASDataEncoder, indent=2))
    except Exception as e:
        # Always return a JSON error so ParserService can parse it
        print(json.dumps({"error": str(e), "type": type(e).__name__}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "File path required"}), file=sys.stderr)
        sys.exit(1)
    
    file_path = sys.argv[1]
    password = sys.argv[2] if len(sys.argv) > 2 else ""
    
    parse_cas(file_path, password)
