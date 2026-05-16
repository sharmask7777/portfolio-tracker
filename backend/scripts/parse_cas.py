import sys
import json
import casparser

def parse_cas(file_path, password):
    try:
        data = casparser.read_cas_pdf(file_path, password)
        # casparser.read_cas_pdf returns a dictionary if output_dict=True (default in some versions)
        # or it might need an explicit flag. Let's check the library behavior.
        # Most recent versions return a dict directly or via read_cas_pdf.
        
        # Ensure it's serializable
        print(json.dumps(data, indent=2, default=str))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "File path required"}), file=sys.stderr)
        sys.exit(1)
    
    file_path = sys.argv[1]
    password = sys.argv[2] if len(sys.argv) > 2 else ""
    
    parse_cas(file_path, password)
