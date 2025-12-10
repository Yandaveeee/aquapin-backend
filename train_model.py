import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
import joblib
import os

# 1. GENERATE SYNTHETIC DATA (Based on Tilapia Growth Models)
def generate_aquaculture_data(n=2000):
    np.random.seed(42) # Ensures we get the same "random" numbers every time
    
    data = []
    for _ in range(n):
        # Random inputs based on typical Philippines small-scale ponds
        area_sqm = np.random.randint(200, 2000)
        
        # Stocking Density: 5 to 15 fish per sqm is standard
        density = np.random.uniform(5, 15)
        fry_quantity = int(area_sqm * density)
        
        # Culture Days: 90 to 150 days (3-5 months)
        days_cultured = np.random.randint(90, 150)
        
        # -- THE SCIENCE PART (Calculating the Outcome) --
        
        # Survival Rate: Higher density = Lower survival
        # Base 90%, minus 1% for every extra fish/sqm over 5
        base_survival = 0.90
        survival_rate = base_survival - ((density - 5) * 0.015)
        # Add some random noise (disease, weather, luck)
        survival_rate += np.random.normal(0, 0.05) 
        survival_rate = np.clip(survival_rate, 0.5, 0.98) # Cap between 50% and 98%

        # Average Weight per Fish: Longer time = Bigger fish
        # Growth curve approximation
        avg_weight_kg = 0.05 + (days_cultured * 0.0025) 
        # Add noise (genetics, feeding quality)
        avg_weight_kg += np.random.normal(0, 0.02)
        
        # Calculate Total Yield
        surviving_fish = fry_quantity * survival_rate
        total_yield_kg = surviving_fish * avg_weight_kg

        data.append([fry_quantity, days_cultured, area_sqm, round(total_yield_kg, 2)])

    # Convert to Table
    df = pd.DataFrame(data, columns=['fry_quantity', 'days_cultured', 'area_sqm', 'yield_kg'])
    return df

# 2. RUN TRAINING
print("🌱 Generating Synthetic Dataset...")
df = generate_aquaculture_data()

# Save CSV so you can show it in your Thesis
csv_path = "ml_engine/data/training_data.csv"
os.makedirs(os.path.dirname(csv_path), exist_ok=True)
df.to_csv(csv_path, index=False)
print(f"✅ Dataset saved to {csv_path}")

# 3. SPLIT DATA
X = df[['fry_quantity', 'days_cultured', 'area_sqm']] # Inputs
y = df['yield_kg']                                    # Target

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# 4. TRAIN MODEL
print("🧠 Training Random Forest Model...")
model = RandomForestRegressor(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

# 5. EVALUATE
predictions = model.predict(X_test)
mae = mean_absolute_error(y_test, predictions)
r2 = r2_score(y_test, predictions)

print(f"\n--- MODEL RESULTS ---")
print(f"Accuracy (R2 Score): {r2:.2f} (1.0 is perfect)")
print(f"Average Error: {mae:.2f} kg")

# 6. SAVE THE BRAIN
model_path = "ml_engine/models/yield_predictor.pkl"
os.makedirs(os.path.dirname(model_path), exist_ok=True)
joblib.dump(model, model_path)
print(f"💾 Model saved to {model_path}")