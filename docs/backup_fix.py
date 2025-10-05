import os

# --- CONFIGURATION ---
# This dictionary defines the rules for fixing the data.
#
# Format:
#   "app_name.model_name_lowercase": ["field_to_fix_1", "field_to_fix_2"],
#
# Example: To fix 'wrid' and 'wrte' in the 'OemSense' model from the 'core' app:
FIX_CONFIG = {
    "core.oemsense": ["wrid", "wrte"],
    "core.oemderived": ["dete"],
    # ADD MORE RULES HERE FOR OTHER MODELS IF NEEDED
    # "another_app.anothermodel": ["some_other_field"],
}
# ---------------------

input_filename = '../cache/backups/full_backup-org.json'
output_filename = '../cache/backups/full_backup.json'

def run_fixer():
    """
    Reads a large JSON backup file line-by-line, corrects specified fields
    from 0 to null, and writes the output to a new file.
    """
    print("Starting targeted fix process...")
    print(f"Input file: '{input_filename}'")
    print(f"Output file: '{output_filename}'")
    print("-" * 20)

    # Ensure the output file doesn't exist to avoid appending to an old run
    if os.path.exists(output_filename):
        os.remove(output_filename)

    lines_processed = 0
    lines_changed = 0
    active_model_rules = None  # Holds the fields to fix for the current model object

    # Open both files for efficient line-by-line processing
    try:
        with open(input_filename, 'r', encoding='utf-8') as input_file, \
             open(output_filename, 'w', encoding='utf-8') as output_file:

            for line in input_file:
                original_line = line
                
                # --- State Machine Logic ---
                
                # 1. Check if this line defines a new model object
                if '"model":' in line:
                    # Extract the model name (e.g., "core.oemsense")
                    try:
                        model_name = line.split('"')[-2]
                        # Check if we have rules for this model in our config
                        if model_name in FIX_CONFIG:
                            active_model_rules = FIX_CONFIG[model_name]
                            print(f"Found model '{model_name}'. Applying rules: {active_model_rules}")
                        else:
                            active_model_rules = None # This model is not in our config
                    except IndexError:
                        # This line might not be a model definition, ignore it
                        active_model_rules = None

                # 2. If we are inside a targeted model object, apply the rules
                if active_model_rules:
                    for field in active_model_rules:
                        # Look for patterns like "wrid": 0, with potential whitespace
                        problem_string = f'"{field}": 0'
                        if problem_string in line:
                            fixed_string = f'"{field}": null'
                            line = line.replace(problem_string, fixed_string)

                # 3. Check for the end of a "fields" block or JSON object to reset our state.
                if line.strip() in ('}', '},'):
                    if active_model_rules:
                        print(f"End of object. Resetting rules for the next one.")
                        active_model_rules = None

                # --- End of State Machine ---
                
                if original_line != line:
                    lines_changed += 1

                output_file.write(line)
                
                lines_processed += 1
                if lines_processed % 500000 == 0:
                    print(f"  ...processed {lines_processed:,} lines")

        print("-" * 20)
        print("Processing complete!")
        print(f"Total lines processed: {lines_processed:,}")
        print(f"Total lines changed: {lines_changed:,}")
        print(f"Corrected file saved as '{output_filename}'")

    except FileNotFoundError:
        print(f"\nERROR: The input file '{input_filename}' was not found.")
        print("Please make sure the backup file is in the same directory as this script.")
    except Exception as e:
        print(f"\nAn unexpected error occurred: {e}")

if __name__ == "__main__":
    run_fixer()
